import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const env = {
  ...readDotEnv(resolve(process.cwd(), ".env")),
  ...process.env
};

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
const ownerEmail = env.COPULA_OWNER_EMAIL || env.COPULA_TEST_EMAIL;
const ownerPassword = env.COPULA_OWNER_PASSWORD || env.COPULA_TEST_PASSWORD;
const memberEmail = env.COPULA_MEMBER_EMAIL;
const memberPassword = env.COPULA_MEMBER_PASSWORD;
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

if (!supabaseUrl || !supabaseAnonKey) {
  fail("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.");
}

if (!ownerEmail || !ownerPassword || !memberEmail || !memberPassword) {
  fail("COPULA_OWNER_EMAIL/COPULA_OWNER_PASSWORD and COPULA_MEMBER_EMAIL/COPULA_MEMBER_PASSWORD are required.");
}

if (ownerEmail.trim().toLowerCase() === memberEmail.trim().toLowerCase()) {
  fail("Owner and member accounts must be different users.");
}

const clientOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
};

const owner = createClient(supabaseUrl, supabaseAnonKey, clientOptions);
const member = createClient(supabaseUrl, supabaseAnonKey, clientOptions);
const anonymous = createClient(supabaseUrl, supabaseAnonKey, clientOptions);

let communityId;

try {
  await check("owner signs in", async () => {
    const { error } = await owner.auth.signInWithPassword({
      email: ownerEmail,
      password: ownerPassword
    });
    if (error) throw error;
  });

  await check("member signs in", async () => {
    const { error } = await member.auth.signInWithPassword({
      email: memberEmail,
      password: memberPassword
    });
    if (error) throw error;
  });

  await check("owner creates push smoke community", async () => {
    const { data, error } = await owner.rpc("create_community", {
      p_name: `Copula Push Smoke ${stamp}`,
      p_description: "Automated push smoke test",
      p_accent: "#8c74ba"
    });
    if (error) throw error;
    communityId = String(data);
  });

  const inviteCode = await check("owner reads invite code", async () => {
    const { data, error } = await owner
      .from("invite_codes")
      .select("code")
      .eq("community_id", communityId)
      .is("disabled_at", null)
      .limit(1)
      .single();
    if (error) throw error;
    return data.code;
  });

  await check("member joins push smoke community", async () => {
    const { data, error } = await member.rpc("join_community_with_invite_code", {
      p_code: inviteCode
    });
    if (error) throw error;
    if (String(data) !== communityId) {
      throw new Error("Joined community id did not match.");
    }
  });

  await check("community notification fanout works", async () => {
    const { data, error } = await owner.rpc("create_community_notifications", {
      p_community_id: communityId,
      p_kind: "notice",
      p_title: `Push Smoke ${stamp}`,
      p_body: "Automated push smoke fanout",
      p_exclude_current_user: true
    });
    if (error) throw error;
    if (Number(data) < 1) {
      throw new Error("Expected at least one notification row for the other member.");
    }
  });

  await check("member reads fanout notification", async () => {
    const { data, error } = await member
      .from("notifications")
      .select("title")
      .eq("community_id", communityId)
      .eq("title", `Push Smoke ${stamp}`)
      .limit(1)
      .single();
    if (error) throw error;
    if (!data) {
      throw new Error("No fanout notification was visible to the member.");
    }
  });

  await check("send-push community permission path responds", async () => {
    const { data, error } = await owner.functions.invoke("send-push", {
      body: {
        communityId,
        userIds: ["00000000-0000-0000-0000-000000000000"],
        title: `Push Smoke ${stamp}`,
        body: "Automated push function smoke",
        excludeCurrentUser: true
      }
    });
    if (error) throw error;
    if (!data || typeof data.sent !== "number" || typeof data.failed !== "number") {
      throw new Error(`Unexpected send-push response: ${JSON.stringify(data)}`);
    }
  });

  await check("anonymous send-push is blocked", async () => {
    const { error } = await anonymous.functions.invoke("send-push", {
      body: {
        communityId,
        title: "Anonymous should fail",
        body: "Automated push function smoke"
      }
    });
    if (!error) {
      throw new Error("Anonymous client invoked send-push.");
    }
  });
} finally {
  if (communityId) {
    await owner.from("communities").delete().eq("id", communityId);
  }
  await Promise.allSettled([owner.auth.signOut(), member.auth.signOut()]);
}

function readDotEnv(filePath) {
  try {
    return Object.fromEntries(
      readFileSync(filePath, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const index = line.indexOf("=");
          if (index === -1) return [line, ""];
          return [line.slice(0, index), line.slice(index + 1)];
        })
    );
  } catch {
    return {};
  }
}

async function check(label, task) {
  try {
    const result = await task();
    console.log(`OK ${label}`);
    return result;
  } catch (error) {
    console.error(`FAIL ${label}`);
    fail(formatError(error));
  }
}

function formatError(error) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error) return JSON.stringify(error, null, 2);
  return String(error);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
