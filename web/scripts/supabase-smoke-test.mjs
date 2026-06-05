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
const shouldSignUp = env.COPULA_TEST_SIGNUP === "1";
const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

if (!supabaseUrl || !supabaseAnonKey) {
  fail("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

await check("public schema responds", async () => {
  const { error } = await supabase.from("communities").select("id").limit(1);
  if (error) throw error;
});

await check("create_community RPC exists and requires auth", async () => {
  const { error } = await supabase.rpc("create_community", {
    p_name: "Smoke Check",
    p_description: "",
    p_accent: "#8c74ba"
  });
  if (!error) throw new Error("RPC unexpectedly allowed an anonymous create.");
  if (!error.message.includes("auth_required")) throw error;
});

await check("album-media storage bucket responds", async () => {
  const { error } = await supabase.storage.from("album-media").list("", { limit: 1 });
  if (error) throw error;
});

if (!testEmail || !testPassword) {
  console.log("SKIP authenticated flow: set COPULA_TEST_EMAIL and COPULA_TEST_PASSWORD to run it.");
  process.exit(0);
}

await check("authenticated community/content flow", async () => {
  if (shouldSignUp) {
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          name: "Copula Smoke"
        }
      }
    });
    if (error) throw error;
    if (!data.session) {
      throw new Error("Signup succeeded but email confirmation is required before authenticated smoke tests.");
    }
  } else {
    const { error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    if (error) throw error;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const user = userData.user;
  if (!user) throw new Error("No authenticated user.");

  let communityId;
  let mediaPath;
  let originalProfile;
  const originalAuthName = user.user_metadata?.name;

  try {
    const profile = await supabase
      .from("profiles")
      .select("display_name, handle")
      .eq("id", user.id)
      .single();
    if (profile.error) throw profile.error;
    originalProfile = profile.data;

    const profileName = `Copula Smoke ${stamp}`;
    const profileHandle = `@copula_smoke_${stamp}`;
    const authUpdate = await supabase.auth.updateUser({
      data: {
        name: profileName
      }
    });
    if (authUpdate.error) throw authUpdate.error;

    const profileUpdate = await supabase
      .from("profiles")
      .update({
        display_name: profileName,
        handle: profileHandle
      })
      .eq("id", user.id);
    if (profileUpdate.error) throw profileUpdate.error;

    const created = await supabase.rpc("create_community", {
      p_name: `Copula Smoke ${stamp}`,
      p_description: "Automated Supabase smoke test",
      p_accent: "#8c74ba"
    });
    if (created.error) throw created.error;
    communityId = String(created.data);

    const inviteCode = await supabase
      .from("invite_codes")
      .select("code")
      .eq("community_id", communityId)
      .is("disabled_at", null)
      .limit(1)
      .single();
    if (inviteCode.error) throw inviteCode.error;

    const event = await supabase.from("calendar_events").insert({
      community_id: communityId,
      title: "Smoke 일정",
      notes: "Automated test",
      location: "Copula",
      starts_at: new Date().toISOString(),
      created_by: user.id
    });
    if (event.error) throw event.error;

    const album = await supabase
      .from("albums")
      .insert({
        community_id: communityId,
        title: "Smoke 앨범",
        description: "Automated test",
        created_by: user.id
      })
      .select("id")
      .single();
    if (album.error) throw album.error;

    mediaPath = `${communityId}/${user.id}/smoke-${stamp}.png`;
    const upload = await supabase.storage
      .from("album-media")
      .upload(mediaPath, tinyPng(), { contentType: "image/png", upsert: false });
    if (upload.error) throw upload.error;

    const albumItem = await supabase.from("album_items").insert({
      community_id: communityId,
      album_id: album.data.id,
      title: "Smoke 사진",
      kind: "photo",
      media_url: mediaPath,
      created_by: user.id
    });
    if (albumItem.error) throw albumItem.error;

    const dday = await supabase.from("ddays").insert({
      community_id: communityId,
      title: "Smoke D-Day",
      target_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      kind: "event",
      note: "Automated test",
      created_by: user.id
    });
    if (dday.error) throw dday.error;

    const notice = await supabase.from("notices").insert({
      community_id: communityId,
      title: "Smoke 공지",
      body: "Automated test",
      pinned: true,
      created_by: user.id
    });
    if (notice.error) throw notice.error;

    const regenerated = await supabase.rpc("regenerate_invite_code", {
      p_community_id: communityId
    });
    if (regenerated.error) throw regenerated.error;
  } finally {
    if (mediaPath) {
      await supabase.storage.from("album-media").remove([mediaPath]);
    }
    if (communityId) {
      await supabase.from("communities").delete().eq("id", communityId);
    }
    if (originalProfile) {
      await supabase.from("profiles").update(originalProfile).eq("id", user.id);
      await supabase.auth.updateUser({
        data: {
          name: originalAuthName
        }
      });
    }
    await supabase.auth.signOut();
  }
});

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
