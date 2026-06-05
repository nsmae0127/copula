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
const shouldSignUpMember = env.COPULA_MEMBER_SIGNUP === "1";
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
    if (shouldSignUpMember) {
      const { data, error } = await member.auth.signUp({
        email: memberEmail,
        password: memberPassword,
        options: { data: { name: "Copula Member Smoke" } }
      });
      if (error) throw error;
      if (!data.session) {
        throw new Error("Signup succeeded but email confirmation is required before member smoke tests.");
      }
      return;
    }

    const { error } = await member.auth.signInWithPassword({
      email: memberEmail,
      password: memberPassword
    });
    if (error) throw error;
  });

  const ownerUser = await getUser(owner);
  const memberUser = await getUser(member);

  await check("owner creates private community", async () => {
    const { data, error } = await owner.rpc("create_community", {
      p_name: `Copula Member Smoke ${stamp}`,
      p_description: "Automated member management smoke test",
      p_accent: "#8c74ba"
    });
    if (error) throw error;
    communityId = String(data);
  });

  const inviteCode = await check("owner reads active invite code", async () => {
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

  await check("member joins by invite code", async () => {
    const { data, error } = await member.rpc("join_community_with_invite_code", {
      p_code: inviteCode
    });
    if (error) throw error;
    if (String(data) !== communityId) {
      throw new Error("Joined community id did not match the owner-created community.");
    }
  });

  const memberRow = await check("owner can see joined member", async () => {
    const { data, error } = await owner
      .from("community_members")
      .select("id, role, user_id")
      .eq("community_id", communityId)
      .eq("user_id", memberUser.id)
      .single();
    if (error) throw error;
    if (data.role !== "member") {
      throw new Error(`Expected joined role member, got ${data.role}.`);
    }
    return data;
  });

  await check("owner promotes member to admin", async () => {
    const { data, error } = await owner.rpc("update_community_member_role", {
      p_community_id: communityId,
      p_member_id: memberRow.id,
      p_role: "admin"
    });
    if (error) throw error;
    if (data.role !== "admin") {
      throw new Error(`Expected updated role admin, got ${data.role}.`);
    }
  });

  await check("owner demotes member back to member", async () => {
    const { data, error } = await owner.rpc("update_community_member_role", {
      p_community_id: communityId,
      p_member_id: memberRow.id,
      p_role: "member"
    });
    if (error) throw error;
    if (data.role !== "member") {
      throw new Error(`Expected updated role member, got ${data.role}.`);
    }
  });

  await check("owner removes member", async () => {
    const { error } = await owner.rpc("remove_community_member", {
      p_community_id: communityId,
      p_member_id: memberRow.id
    });
    if (error) throw error;
  });

  await check("removed member can no longer read community", async () => {
    const { data, error } = await member
      .from("communities")
      .select("id")
      .eq("id", communityId)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      throw new Error("Removed member could still read the private community row.");
    }
  });

  if (!ownerUser.id) {
    throw new Error("Owner user id is missing.");
  }
} finally {
  if (communityId) {
    await owner.from("communities").delete().eq("id", communityId);
  }
  await Promise.allSettled([owner.auth.signOut(), member.auth.signOut()]);
}

async function getUser(client) {
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("No authenticated user.");
  return data.user;
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
