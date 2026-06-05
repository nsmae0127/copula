import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const env = {
  ...readDotEnv(resolve(process.cwd(), ".env")),
  ...process.env
};

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
const testEmail = env.COPULA_TEST_EMAIL;
const testPassword = env.COPULA_TEST_PASSWORD;
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

if (!supabaseUrl || !supabaseAnonKey) {
  fail("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.");
}

if (!testEmail || !testPassword) {
  fail("COPULA_TEST_EMAIL and COPULA_TEST_PASSWORD are required.");
}

const clientOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
};

const authenticated = createClient(supabaseUrl, supabaseAnonKey, clientOptions);
const anonymous = createClient(supabaseUrl, supabaseAnonKey, clientOptions);

let communityId;
let leakedEventId;
let leakedMediaPath;
let pushEndpoint;
let leakedPushEndpoint;

try {
  await check("authenticated user signs in", async () => {
    const { error } = await authenticated.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    if (error) throw error;
  });

  const { data: userData, error: userError } = await authenticated.auth.getUser();
  if (userError) throw userError;
  const user = userData.user;
  if (!user) throw new Error("No authenticated user.");

  await check("authenticated user creates private community", async () => {
    const { data, error } = await authenticated.rpc("create_community", {
      p_name: `Copula RLS Smoke ${stamp}`,
      p_description: "Automated Supabase RLS smoke test",
      p_accent: "#8c74ba"
    });
    if (error) throw error;
    communityId = String(data);
  });

  await check("anonymous community read is blocked", async () => {
    const { data, error } = await anonymous
      .from("communities")
      .select("id")
      .eq("id", communityId)
      .maybeSingle();
    if (error) throw error;
    if (data) throw new Error("Anonymous client read a private community row.");
  });

  await check("anonymous community write is blocked", async () => {
    const { data, error } = await anonymous
      .from("calendar_events")
      .insert({
        community_id: communityId,
        title: "Anonymous insert should fail",
        starts_at: new Date().toISOString(),
        created_by: user.id
      })
      .select("id")
      .maybeSingle();

    if (!error) {
      leakedEventId = data?.id;
      throw new Error("Anonymous client inserted a community event.");
    }
  });

  await check("anonymous media upload is blocked", async () => {
    const mediaPath = `${communityId}/${user.id}/anonymous-upload-${stamp}.png`;
    const { error } = await anonymous.storage
      .from("album-media")
      .upload(mediaPath, tinyPng(), { contentType: "image/png", upsert: false });

    if (!error) {
      leakedMediaPath = mediaPath;
      throw new Error("Anonymous client uploaded media into a private community path.");
    }
  });

  await check("authenticated user stores push subscription", async () => {
    pushEndpoint = `https://push.example.invalid/copula-smoke-${stamp}`;
    const { error } = await authenticated
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint: pushEndpoint,
          p256dh: "smoke-p256dh",
          auth: "smoke-auth",
          user_agent: "copula-smoke"
        },
        { onConflict: "user_id,endpoint" }
      );
    if (error) throw error;
  });

  await check("anonymous push subscription write is blocked", async () => {
    const endpoint = `https://push.example.invalid/anonymous-${stamp}`;
    const { error } = await anonymous
      .from("push_subscriptions")
      .insert({
        user_id: user.id,
        endpoint,
        p256dh: "anonymous-p256dh",
        auth: "anonymous-auth",
        user_agent: "copula-smoke"
      });

    if (!error) {
      leakedPushEndpoint = endpoint;
      throw new Error("Anonymous client inserted a push subscription.");
    }
  });
} finally {
  if (pushEndpoint) {
    await authenticated.from("push_subscriptions").delete().eq("endpoint", pushEndpoint);
  }
  if (leakedPushEndpoint) {
    await authenticated.from("push_subscriptions").delete().eq("endpoint", leakedPushEndpoint);
  }
  if (leakedMediaPath) {
    await authenticated.storage.from("album-media").remove([leakedMediaPath]);
  }
  if (leakedEventId) {
    await authenticated.from("calendar_events").delete().eq("id", leakedEventId);
  }
  if (communityId) {
    await authenticated.from("communities").delete().eq("id", communityId);
  }
  await authenticated.auth.signOut();
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
    await task();
    console.log(`OK ${label}`);
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

function tinyPng() {
  return Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64"
    )
  );
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
