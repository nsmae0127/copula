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
  await check("relationship tables are installed", async () => {
    const { error } = await anonymous.from("relationship_pairs").select("id").limit(1);
    if (isMissingRelationshipTables(error)) {
      throw new Error("Apply supabase/migrations/20260515000000_relationships.sql before running this smoke test.");
    }
    if (error && !isRlsReadBlock(error)) throw error;
  });

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

  const ownerUser = await getUser(owner);
  const memberUser = await getUser(member);

  await check("owner creates private community", async () => {
    const { data, error } = await owner.rpc("create_community", {
      p_name: `Copula Relationship Smoke ${stamp}`,
      p_description: "Automated relationship smoke test",
      p_accent: "#f0717a"
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

  const memberRows = await check("owner reads relationship member ids", async () => {
    const { data, error } = await owner
      .from("community_members")
      .select("id, user_id")
      .eq("community_id", communityId)
      .in("user_id", [ownerUser.id, memberUser.id]);
    if (error) throw error;
    if (!data || data.length !== 2) {
      throw new Error("Expected owner and member community member rows.");
    }
    return data;
  });

  const ownerMemberId = memberRows.find((row) => row.user_id === ownerUser.id)?.id;
  const memberMemberId = memberRows.find((row) => row.user_id === memberUser.id)?.id;
  if (!ownerMemberId || !memberMemberId) {
    throw new Error("Could not resolve owner/member relationship ids.");
  }

  const pairId = await check("owner creates 1:1 relationship pair", async () => {
    const { data, error } = await owner
      .from("relationship_pairs")
      .insert({
        community_id: communityId,
        first_member_id: ownerMemberId,
        second_member_id: memberMemberId,
        label: `Smoke Pair ${stamp}`,
        created_by: ownerUser.id
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  });

  await check("member cannot create relationship pair", async () => {
    const { error } = await member.from("relationship_pairs").insert({
      community_id: communityId,
      first_member_id: ownerMemberId,
      second_member_id: memberMemberId,
      label: "Member insert should fail",
      created_by: memberUser.id
    });
    if (!error) {
      throw new Error("Member created a relationship pair without admin role.");
    }
  });

  const circleId = await check("owner creates 1:N circle", async () => {
    const { data, error } = await owner
      .from("circles")
      .insert({
        community_id: communityId,
        name: `Smoke Circle ${stamp}`,
        created_by: ownerUser.id
      })
      .select("id")
      .single();
    if (error) throw error;

    const members = await owner.from("circle_members").insert([
      { community_id: communityId, circle_id: data.id, member_id: ownerMemberId },
      { community_id: communityId, circle_id: data.id, member_id: memberMemberId }
    ]);
    if (members.error) throw members.error;
    return data.id;
  });

  await check("member cannot create circle", async () => {
    const { error } = await member.from("circles").insert({
      community_id: communityId,
      name: "Member circle should fail",
      created_by: memberUser.id
    });
    if (!error) {
      throw new Error("Member created a circle without admin role.");
    }
  });

  const commitmentId = await check("owner creates pair-scoped commitment", async () => {
    const { data, error } = await owner
      .from("commitments")
      .insert({
        community_id: communityId,
        title: `Smoke Commitment ${stamp}`,
        note: "Automated relationship test",
        due_at: new Date(Date.now() + 86400000).toISOString(),
        visibility_type: "pair",
        pair_id: pairId,
        created_by: ownerUser.id
      })
      .select("id")
      .single();
    if (error) throw error;

    const assignees = await owner.from("commitment_assignees").insert([
      { community_id: communityId, commitment_id: data.id, member_id: ownerMemberId },
      { community_id: communityId, commitment_id: data.id, member_id: memberMemberId }
    ]);
    if (assignees.error) throw assignees.error;
    return data.id;
  });

  await check("member reads relationship data", async () => {
    const [pair, circle, circleMembers, commitment, assignees] = await Promise.all([
      member.from("relationship_pairs").select("id").eq("id", pairId).single(),
      member.from("circles").select("id").eq("id", circleId).single(),
      member.from("circle_members").select("id").eq("circle_id", circleId),
      member.from("commitments").select("id, status").eq("id", commitmentId).single(),
      member.from("commitment_assignees").select("id").eq("commitment_id", commitmentId)
    ]);

    for (const result of [pair, circle, circleMembers, commitment, assignees]) {
      if (result.error) throw result.error;
    }
    if ((circleMembers.data ?? []).length !== 2) {
      throw new Error("Expected two circle members.");
    }
    if ((assignees.data ?? []).length !== 2) {
      throw new Error("Expected two commitment assignees.");
    }
    if (commitment.data.status !== "open") {
      throw new Error(`Expected commitment status open, got ${commitment.data.status}.`);
    }
  });

  await check("owner fans out community notification", async () => {
    const { data, error } = await owner.rpc("create_community_notifications", {
      p_community_id: communityId,
      p_kind: "commitment",
      p_title: `Smoke Notification ${stamp}`,
      p_body: "Automated relationship notification test",
      p_exclude_current_user: true
    });
    if (error) throw error;
    if (Number(data) < 1) {
      throw new Error("Expected at least one notification for another community member.");
    }

    const notification = await member
      .from("notifications")
      .select("kind, title, body")
      .eq("community_id", communityId)
      .eq("kind", "commitment")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (notification.error) throw notification.error;
    if (notification.data.title !== `Smoke Notification ${stamp}`) {
      throw new Error("Member did not receive the community notification.");
    }
  });

  await check("assigned member completes commitment", async () => {
    const { data, error } = await member
      .from("commitments")
      .update({
        status: "done",
        completed_at: new Date().toISOString()
      })
      .eq("id", commitmentId)
      .select("status, completed_at")
      .single();
    if (error) throw error;
    if (data.status !== "done" || !data.completed_at) {
      throw new Error("Commitment did not move to done.");
    }
  });

  await check("anonymous relationship write is blocked", async () => {
    const { error } = await anonymous.from("relationship_pairs").insert({
      community_id: communityId,
      first_member_id: ownerMemberId,
      second_member_id: memberMemberId,
      label: "Anonymous insert should fail",
      created_by: ownerUser.id
    });

    if (!error) {
      throw new Error("Anonymous client inserted a relationship pair.");
    }
  });
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

function isMissingRelationshipTables(error) {
  if (!error) return false;
  return error.code === "PGRST205" || error.message?.includes("Could not find the table");
}

function isRlsReadBlock(error) {
  if (!error) return false;
  return error.code === "42501" || error.message?.toLowerCase().includes("permission denied");
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
