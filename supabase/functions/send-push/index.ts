import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type PushRequest = {
  userIds?: string[];
  communityId?: string;
  excludeCurrentUser?: boolean;
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@copula.app";

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return json({ error: "missing_push_configuration" }, 500);
  }

  const authorization = request.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authorization
      }
    }
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: "auth_required" }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const payload = await readJson<PushRequest>(request);
  const targetUserIdsResult = await resolveTargetUserIds({
    payload,
    userId: userData.user.id,
    userClient,
    adminClient
  });

  if ("error" in targetUserIdsResult) {
    return json({ error: targetUserIdsResult.error }, targetUserIdsResult.status);
  }

  const title = payload.title?.trim() || "Copula";
  const body = payload.body?.trim() || "새 알림이 있습니다.";
  if (!targetUserIdsResult.userIds.length) {
    return json({ sent: 0, failed: 0, staleRemoved: 0 });
  }

  const { data: subscriptions, error } = await adminClient
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", targetUserIdsResult.userIds);

  if (error) {
    return json({ error: error.message }, 500);
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const subscriptionRows = subscriptions ?? [];
  const results = await Promise.allSettled(
    subscriptionRows.map((subscription) =>
      webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth
          }
        },
        JSON.stringify({
          title,
          body,
          url: payload.url || "/",
          tag: payload.tag || "copula"
        })
      )
    )
  );

  const staleSubscriptionIds = results
    .map((result, index) => ({ result, subscription: subscriptionRows[index] }))
    .filter(({ result }) => result.status === "rejected" && isStalePushError(result.reason))
    .map(({ subscription }) => subscription.id);

  if (staleSubscriptionIds.length) {
    await adminClient.from("push_subscriptions").delete().in("id", staleSubscriptionIds);
  }

  return json({
    sent: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length,
    staleRemoved: staleSubscriptionIds.length
  });
});

type SupabaseLikeClient = ReturnType<typeof createClient>;

async function resolveTargetUserIds({
  payload,
  userId,
  userClient,
  adminClient
}: {
  payload: PushRequest;
  userId: string;
  userClient: SupabaseLikeClient;
  adminClient: SupabaseLikeClient;
}): Promise<{ userIds: string[] } | { error: string; status: number }> {
  if (!payload.communityId) {
    const targetUserIds = payload.userIds?.length ? unique(payload.userIds) : [userId];
    const canSend = targetUserIds.every((targetUserId) => targetUserId === userId);
    return canSend
      ? { userIds: targetUserIds }
      : { error: "insufficient_permission", status: 403 };
  }

  const { data: callerMembership, error: membershipError } = await userClient
    .from("community_members")
    .select("id")
    .eq("community_id", payload.communityId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError || !callerMembership) {
    return { error: "insufficient_permission", status: 403 };
  }

  const { data: members, error: membersError } = await adminClient
    .from("community_members")
    .select("user_id")
    .eq("community_id", payload.communityId);

  if (membersError) {
    return { error: membersError.message, status: 500 };
  }

  const memberUserIds = new Set((members ?? []).map((member) => member.user_id));
  const requestedUserIds = payload.userIds?.length
    ? unique(payload.userIds).filter((targetUserId) => memberUserIds.has(targetUserId))
    : [...memberUserIds];
  const userIds = payload.excludeCurrentUser === false
    ? requestedUserIds
    : requestedUserIds.filter((targetUserId) => targetUserId !== userId);

  return { userIds };
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function isStalePushError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const statusCode = "statusCode" in error ? Number(error.statusCode) : 0;
  return statusCode === 404 || statusCode === 410;
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return await request.json();
  } catch {
    return {} as T;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
