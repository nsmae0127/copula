import type { AuthChangeEvent, Provider, User } from "@supabase/supabase-js";
import { emptyState } from "../data";
import { getSupabaseClient } from "../lib/supabaseClient";
import type {
  Album,
  AlbumItemInput,
  AlbumItem,
  AlbumItemUpdateInput,
  CalendarEvent,
  Circle,
  Community,
  CommunityModule,
  CommunityMessage,
  CommunityMember,
  Commitment,
  CopulaNotification,
  CopulaState,
  DDayItem,
  Notice,
  NotificationKind,
  OneSecondLog,
  PushSubscriptionPayload,
  RelationshipPair,
  Role,
  UserProfile
} from "../types";
import { createId, initials } from "../utils";
import type { AuthStateChangeEvent, CopulaRepository, OAuthProvider } from "./repository";
import { getCachedState, saveCachedState, addToSyncQueue, getSyncQueue, removeSyncQueueItem } from "../utils/offlineCache";

type ProfileRow = {
  id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
};

type CommunityRow = {
  id: string;
  name: string;
  description: string;
  accent: string;
  cover_url: string | null;
  created_at: string;
};

type CommunityMemberRow = {
  id: string;
  community_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
};

type CommunityContentModuleRow = {
  community_id: string;
  module: CommunityModule;
  enabled_at: string;
};

type InviteCodeRow = {
  community_id: string;
  code: string;
};

type CalendarEventRow = {
  id: string;
  community_id: string;
  title: string;
  notes: string;
  location: string;
  starts_at: string;
  created_at: string;
};

type OneSecondLogRow = {
  id: string;
  community_id: string;
  user_id: string;
  video_url: string;
  caption: string;
  created_at: string;
};

type CommunityMessageRow = {
  id: string;
  community_id: string;
  sender_member_id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
};

type MessageReactionRow = {
  id: string;
  community_id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

type AlbumRow = {
  id: string;
  community_id: string;
  title: string;
  description: string;
  created_at: string;
};

type AlbumItemRow = {
  id: string;
  community_id: string;
  album_id: string;
  title: string;
  kind: "photo" | "video" | "note";
  media_url: string | null;
  created_by: string;
  created_at: string;
};

type DDayRow = {
  id: string;
  community_id: string;
  title: string;
  target_date: string;
  kind: "anniversary" | "trip" | "birthday" | "event";
  note: string;
};

type NoticeRow = {
  id: string;
  community_id: string;
  title: string;
  body: string;
  pinned: boolean;
  created_at: string;
};

type NotificationRow = {
  id: string;
  kind: NotificationKind;
  community_id: string | null;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

type RelationshipPairRow = {
  id: string;
  community_id: string;
  first_member_id: string;
  second_member_id: string;
  label: string;
  created_at: string;
};

type CircleRow = {
  id: string;
  community_id: string;
  name: string;
  created_at: string;
};

type CircleMemberRow = {
  circle_id: string;
  member_id: string;
};

type CommitmentRow = {
  id: string;
  community_id: string;
  title: string;
  note: string;
  due_at: string;
  status: "open" | "done";
  visibility_type: "community" | "circle" | "pair" | "private";
  pair_id: string | null;
  circle_id: string | null;
  created_by: string;
  created_at: string;
  completed_at: string | null;
};

type CommitmentAssigneeRow = {
  commitment_id: string;
  member_id: string;
};

const communitySelect = "id, name, description, accent, cover_url, created_at";
const profileSelect = "id, display_name, handle, avatar_url";
const memberSelect = "id, community_id, user_id, role, joined_at";
const contentModuleSelect = "community_id, module, enabled_at";
const eventSelect = "id, community_id, title, notes, location, starts_at, created_at";
const albumSelect = "id, community_id, title, description, created_at";
const albumItemSelect = "id, community_id, album_id, title, kind, media_url, created_by, created_at";
const ddaySelect = "id, community_id, title, target_date, kind, note";
const noticeSelect = "id, community_id, title, body, pinned, created_at";
const notificationSelect = "id, community_id, kind, title, body, read_at, created_at";
const messageSelect = "id, community_id, sender_member_id, sender_user_id, body, created_at";
const messageReactionSelect = "id, community_id, message_id, user_id, emoji, created_at";
const relationshipPairSelect = "id, community_id, first_member_id, second_member_id, label, created_at";
const circleSelect = "id, community_id, name, created_at";
const circleMemberSelect = "circle_id, member_id";
const commitmentSelect = "id, community_id, title, note, due_at, status, visibility_type, pair_id, circle_id, created_by, created_at, completed_at";
const commitmentAssigneeSelect = "commitment_id, member_id";
const relationshipOverlayKey = "copula.supabase.relationshipOverlay.v1";

type RelationshipOverlayEntry = {
  pairs: RelationshipPair[];
  circles: Circle[];
  commitments: Commitment[];
};

type RelationshipExtrasByCommunity = Map<string, RelationshipOverlayEntry>;

const ddayKindLabels: Record<DDayRow["kind"], DDayItem["kind"]> = {
  anniversary: "기념일",
  trip: "여행",
  birthday: "생일",
  event: "행사"
};

const ddayKindValues: Record<DDayItem["kind"], DDayRow["kind"]> = {
  기념일: "anniversary",
  여행: "trip",
  생일: "birthday",
  행사: "event"
};

export function createSupabaseRepository(): CopulaRepository {
  const supabase = getSupabaseClient();

  async function currentUser(): Promise<User | null> {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      throw new Error(sessionError.message);
    }
    if (!sessionData.session) {
      return null;
    }

    const { data, error } = await supabase.auth.getUser();
    if (error) {
      throw new Error(error.message);
    }

    return data.user;
  }

  async function requireUser(): Promise<User> {
    const user = await currentUser();
    if (!user) {
      throw new Error("로그인이 필요합니다.");
    }

    return user;
  }

  async function ensureCurrentProfile(user: User): Promise<ProfileRow> {
    const existing = await maybeOne<ProfileRow>(
      supabase.from("profiles").select(profileSelect).eq("id", user.id).maybeSingle()
    );

    if (existing) {
      return existing;
    }

    const displayName = profileNameFromUser(user);
    return one<ProfileRow>(
      supabase
        .from("profiles")
        .insert({
          id: user.id,
          display_name: displayName,
          handle: profileHandleFromId(user.id)
        })
        .select(profileSelect)
        .single()
    );
  }

  async function loadState(): Promise<CopulaState> {
    try {
      const user = await currentUser();
      if (!user) {
        return emptyState();
      }

    const currentProfile = await ensureCurrentProfile(user);
    const communities = await rows<CommunityRow>(
      supabase.from("communities").select(communitySelect).order("created_at", { ascending: false })
    );
    const communityIds = communities.map((community) => community.id);
    const notificationsPromise = rows<NotificationRow>(
      supabase
        .from("notifications")
        .select(notificationSelect)
        .order("created_at", { ascending: false })
        .limit(50)
    );

    if (!communityIds.length) {
      return {
        ...emptyState(mapProfile(currentProfile)),
        notifications: (await notificationsPromise).map(mapNotification)
      };
    }

    const [
      members,
      events,
      albums,
      albumItems,
      ddays,
      notices,
      inviteCodes,
      contentModules,
      oneSecondLogs,
      messageExtras,
      notifications
    ] = await Promise.all([
      rows<CommunityMemberRow>(
        supabase.from("community_members").select(memberSelect).in("community_id", communityIds)
      ),
      rows<CalendarEventRow>(
        supabase
          .from("calendar_events")
          .select(eventSelect)
          .in("community_id", communityIds)
          .order("starts_at", { ascending: true })
      ),
      rows<AlbumRow>(
        supabase
          .from("albums")
          .select(albumSelect)
          .in("community_id", communityIds)
          .order("created_at", { ascending: false })
      ),
      rows<AlbumItemRow>(
        supabase
          .from("album_items")
          .select(albumItemSelect)
          .in("community_id", communityIds)
          .order("created_at", { ascending: false })
      ),
      rows<DDayRow>(
        supabase
          .from("ddays")
          .select(ddaySelect)
          .in("community_id", communityIds)
          .order("target_date", { ascending: true })
      ),
      rows<NoticeRow>(
        supabase
          .from("notices")
          .select(noticeSelect)
          .in("community_id", communityIds)
          .order("pinned", { ascending: false })
          .order("created_at", { ascending: false })
      ),
      rows<InviteCodeRow>(
        supabase
          .from("invite_codes")
          .select("community_id, code")
          .in("community_id", communityIds)
          .order("created_at", { ascending: false })
      ),
      loadContentModules(communityIds),
      rows<OneSecondLogRow>(
        (supabase.from("one_second_logs" as any) as any)
          .select("*")
          .in("community_id", communityIds)
          .order("created_at", { ascending: false })
      ),
      loadMessageExtras(communityIds),
      notificationsPromise
    ]);

    const profiles = await loadProfiles([
      currentProfile.id,
      ...members.map((member) => member.user_id),
      ...albumItems.map((item) => item.created_by),
      ...oneSecondLogs.map((log) => log.user_id),
      ...messageExtras.messages.map((message) => message.sender_user_id),
      ...messageExtras.reactions.map((reaction) => reaction.user_id)
    ]);
    const mediaUrls = await createAlbumMediaUrls(albumItems);
    const videoUrls = await createOneSecondVideoUrls(oneSecondLogs);
    profiles.set(currentProfile.id, currentProfile);

    const membersByCommunity = groupBy(members, (member) => member.community_id);
    const eventsByCommunity = groupBy(events, (event) => event.community_id);
    const albumsByCommunity = groupBy(albums, (album) => album.community_id);
    const albumItemsByAlbum = groupBy(albumItems, (item) => item.album_id);
    const ddaysByCommunity = groupBy(ddays, (dday) => dday.community_id);
    const noticesByCommunity = groupBy(notices, (notice) => notice.community_id);
    const contentModulesByCommunity = groupBy(contentModules, (module) => module.community_id);
    const oneSecondLogsByCommunity = groupBy(oneSecondLogs, (log) => log.community_id);
    const messagesByCommunity = groupBy(messageExtras.messages, (message) => message.community_id);
    const reactionsByMessage = groupBy(messageExtras.reactions, (reaction) => reaction.message_id);
    const inviteCodeByCommunity = firstBy(inviteCodes, (inviteCode) => inviteCode.community_id);
    const relationshipExtras = await loadRelationshipExtras(communityIds);

    const mappedCommunities = communities.map((community) =>
      mapCommunity(community, {
        inviteCode: inviteCodeByCommunity.get(community.id)?.code ?? "초대 코드 비공개",
        members: (membersByCommunity.get(community.id) ?? []).map((member) =>
          mapMember(member, profiles)
        ),
        events: (eventsByCommunity.get(community.id) ?? []).map(mapEvent),
        albums: (albumsByCommunity.get(community.id) ?? []).map((album) =>
          mapAlbum(album, albumItemsByAlbum, profiles, mediaUrls)
        ),
        ddays: (ddaysByCommunity.get(community.id) ?? []).map(mapDDay),
        notices: (noticesByCommunity.get(community.id) ?? []).map(mapNotice),
        contentModules: normalizeStoredCommunityModules(
          (contentModulesByCommunity.get(community.id) ?? []).map((module) => module.module)
        ),
        pairs: relationshipExtras?.get(community.id)?.pairs ?? [],
        circles: relationshipExtras?.get(community.id)?.circles ?? [],
        commitments: relationshipExtras?.get(community.id)?.commitments ?? [],
        oneSecondLogs: (oneSecondLogsByCommunity.get(community.id) ?? []).map((log) =>
          mapOneSecondLog(log, profiles, videoUrls)
        ),
        messages: (messagesByCommunity.get(community.id) ?? [])
          .map((message) => mapCommunityMessage(message, profiles, reactionsByMessage))
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      })
    );
    const communitiesWithRelationships = relationshipExtras
      ? mappedCommunities
      : mergeRelationshipOverlay(currentProfile.id, mappedCommunities);

      const result = {
        currentUser: mapProfile(currentProfile),
        selectedCommunityId: communitiesWithRelationships[0]?.id ?? null,
        communities: communitiesWithRelationships,
        notifications: notifications.map(mapNotification)
      };
      await saveCachedState(result);
      return result;
    } catch (error) {
      console.warn("loadState failed, trying offline cache:", error);
      const cached = await getCachedState();
      if (cached) {
        return cached;
      }
      throw error;
    }
  }

  async function loadCommunity(communityId: string): Promise<Community> {
    const nextState = await loadState();
    const community = nextState.communities.find((item) => item.id === communityId);
    if (!community) {
      throw new Error("copula 정보를 불러오지 못했습니다.");
    }

    return community;
  }

  async function loadCommunityMessage(communityId: string, messageId: string): Promise<CommunityMessage> {
    const message = await one<CommunityMessageRow>(
      (supabase.from("community_messages" as any) as any)
        .select(messageSelect)
        .eq("community_id", communityId)
        .eq("id", messageId)
        .single()
    );
    const reactions = await rows<MessageReactionRow>(
      (supabase.from("message_reactions" as any) as any)
        .select(messageReactionSelect)
        .eq("community_id", communityId)
        .eq("message_id", messageId)
        .order("created_at", { ascending: true })
    );
    const profiles = await loadProfiles([message.sender_user_id]);

    return mapCommunityMessage(message, profiles, groupBy(reactions, (reaction) => reaction.message_id));
  }

  async function loadCommunityMessages(communityId: string): Promise<CommunityMessage[]> {
    try {
      const messages = await rows<CommunityMessageRow>(
        (supabase.from("community_messages" as any) as any)
          .select(messageSelect)
          .eq("community_id", communityId)
          .order("created_at", { ascending: true })
          .limit(500)
      );
      if (!messages.length) {
        return [];
      }

      const reactions = await rows<MessageReactionRow>(
        (supabase.from("message_reactions" as any) as any)
          .select(messageReactionSelect)
          .eq("community_id", communityId)
          .in("message_id", messages.map((message) => message.id))
          .order("created_at", { ascending: true })
      );
      const profiles = await loadProfiles([
        ...messages.map((message) => message.sender_user_id),
        ...reactions.map((reaction) => reaction.user_id)
      ]);
      const reactionsByMessage = groupBy(reactions, (reaction) => reaction.message_id);

      return messages.map((message) => mapCommunityMessage(message, profiles, reactionsByMessage));
    } catch (error) {
      if (isMissingMessageTables(error)) {
        return [];
      }

      throw error;
    }
  }

  async function loadProfiles(userIds: string[]) {
    const uniqueIds = [...new Set(userIds)].filter(Boolean);
    const profileMap = new Map<string, ProfileRow>();
    if (!uniqueIds.length) {
      return profileMap;
    }

    const profiles = await rows<ProfileRow>(
      supabase.from("profiles").select(profileSelect).in("id", uniqueIds)
    );
    profiles.forEach((profile) => profileMap.set(profile.id, profile));
    return profileMap;
  }

  async function loadContentModules(communityIds: string[]): Promise<CommunityContentModuleRow[]> {
    try {
      return await rows<CommunityContentModuleRow>(
        (supabase.from("community_content_modules" as any) as any)
          .select(contentModuleSelect)
          .in("community_id", communityIds)
          .order("enabled_at", { ascending: true })
      );
    } catch (error) {
      if (isMissingContentModuleTable(error)) {
        return [];
      }

      throw error;
    }
  }

  async function loadRelationshipExtras(communityIds: string[]): Promise<RelationshipExtrasByCommunity | null> {
    try {
      const [pairs, circles, circleMembers, commitments, commitmentAssignees] = await Promise.all([
        rows<RelationshipPairRow>(
          supabase
            .from("relationship_pairs")
            .select(relationshipPairSelect)
            .in("community_id", communityIds)
            .order("created_at", { ascending: false })
        ),
        rows<CircleRow>(
          supabase
            .from("circles")
            .select(circleSelect)
            .in("community_id", communityIds)
            .order("created_at", { ascending: false })
        ),
        rows<CircleMemberRow>(
          supabase
            .from("circle_members")
            .select(circleMemberSelect)
            .in("community_id", communityIds)
        ),
        rows<CommitmentRow>(
          supabase
            .from("commitments")
            .select(commitmentSelect)
            .in("community_id", communityIds)
            .order("status", { ascending: true })
            .order("due_at", { ascending: true })
        ),
        rows<CommitmentAssigneeRow>(
          supabase
            .from("commitment_assignees")
            .select(commitmentAssigneeSelect)
            .in("community_id", communityIds)
        )
      ]);

      const circleMembersByCircle = groupBy(circleMembers, (member) => member.circle_id);
      const assigneesByCommitment = groupBy(commitmentAssignees, (assignee) => assignee.commitment_id);

      return communityIds.reduce<RelationshipExtrasByCommunity>((extras, communityId) => {
        extras.set(communityId, {
          pairs: pairs
            .filter((pair) => pair.community_id === communityId)
            .map(mapRelationshipPair),
          circles: circles
            .filter((circle) => circle.community_id === communityId)
            .map((circle) => mapCircle(circle, circleMembersByCircle)),
          commitments: commitments
            .filter((commitment) => commitment.community_id === communityId)
            .map((commitment) => mapCommitment(commitment, assigneesByCommitment))
        });
        return extras;
      }, new Map());
    } catch (error) {
      if (isMissingRelationshipTables(error)) {
        return null;
      }

      throw error;
    }
  }

  async function loadMessageExtras(communityIds: string[]) {
    try {
      const messages = await rows<CommunityMessageRow>(
        (supabase.from("community_messages" as any) as any)
          .select(messageSelect)
          .in("community_id", communityIds)
          .order("created_at", { ascending: false })
          .limit(500)
      );
      if (!messages.length) {
        return { messages, reactions: [] as MessageReactionRow[] };
      }

      const reactions = await rows<MessageReactionRow>(
        (supabase.from("message_reactions" as any) as any)
          .select(messageReactionSelect)
          .in("message_id", messages.map((message) => message.id))
          .order("created_at", { ascending: true })
      );

      return { messages, reactions };
    } catch (error) {
      if (isMissingMessageTables(error)) {
        return { messages: [] as CommunityMessageRow[], reactions: [] as MessageReactionRow[] };
      }

      throw error;
    }
  }

  async function addOneSecondLog(
    communityId: string,
    input: { file: File; caption: string }
  ): Promise<OneSecondLog> {
    const user = await currentUser();
    if (!user) throw new Error("로그인이 필요합니다.");

    const profile = await ensureCurrentProfile(user);
    const path = await uploadOneSecondVideo(communityId, profile.id, input.file);

    const supabase = getSupabaseClient();
    const { data, error } = await (supabase
      .from("one_second_logs" as any) as any)
      .insert({
        community_id: communityId,
        user_id: profile.id,
        video_url: path,
        caption: input.caption
      })
      .select()
      .single();

    if (error) {
      throw new Error(readableSupabaseError(error.message));
    }

    const row = data as OneSecondLogRow;
    const videoUrls = await createOneSecondVideoUrls([row]);
    const profiles = new Map<string, ProfileRow>([[profile.id, profile]]);

    return mapOneSecondLog(row, profiles, videoUrls);
  }

  async function deleteOneSecondLog(communityId: string, logId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await (supabase
      .from("one_second_logs" as any) as any)
      .delete()
      .eq("id", logId)
      .eq("community_id", communityId);

    if (error) {
      throw new Error(readableSupabaseError(error.message));
    }
  }

  async function uploadOneSecondVideo(communityId: string, userId: string, file: File): Promise<string> {
    const supabase = getSupabaseClient();
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "mp4";
    const path = `${communityId}/${userId}/1s-${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("album-media").upload(path, file, {
      contentType: file.type || "video/mp4",
      upsert: false
    });

    if (error) {
      throw new Error(error.message);
    }

    return path;
  }

  async function executeMutation<T>(
    action: string,
    args: any[],
    onlineCallback: () => Promise<T>,
    offlineFallback: () => T
  ): Promise<T> {
    if (!navigator.onLine) {
      console.warn(`Offline: Queueing ${action}`);
      await addToSyncQueue(action, args);
      return offlineFallback();
    }

    try {
      return await onlineCallback();
    } catch (error: any) {
      const isNetworkError = !navigator.onLine || error.message?.includes("fetch") || error.status === 0;
      if (isNetworkError) {
        console.warn(`Network Error: Queueing ${action}`, error);
        await addToSyncQueue(action, args);
        return offlineFallback();
      }
      throw error;
    }
  }

  const repo: CopulaRepository = {
    backend: "supabase",

    getInitialState() {
      return emptyState();
    },

    loadState,

    loadCommunityMessages,

    async sendMessage(communityId, body) {
      const user = await requireUser();
      const profile = await ensureCurrentProfile(user);
      const member = await one<CommunityMemberRow>(
        supabase
          .from("community_members")
          .select(memberSelect)
          .eq("community_id", communityId)
          .eq("user_id", user.id)
          .single()
      );
      const row = await one<CommunityMessageRow>(
        (supabase.from("community_messages" as any) as any)
          .insert({
            community_id: communityId,
            sender_member_id: member.id,
            sender_user_id: user.id,
            body: body.trim()
          })
          .select(messageSelect)
          .single()
      );

      return mapCommunityMessage(row, new Map([[profile.id, profile]]), new Map());
    },

    async toggleMessageReaction(communityId, messageId, emoji) {
      const user = await requireUser();
      const existing = await maybeOne<MessageReactionRow>(
        (supabase.from("message_reactions" as any) as any)
          .select(messageReactionSelect)
          .eq("community_id", communityId)
          .eq("message_id", messageId)
          .eq("user_id", user.id)
          .eq("emoji", emoji)
          .maybeSingle()
      );

      if (existing) {
        const { error } = await (supabase.from("message_reactions" as any) as any)
          .delete()
          .eq("id", existing.id)
          .eq("community_id", communityId);
        if (error) {
          throw new Error(readableSupabaseError(error.message));
        }
      } else {
        const { error } = await (supabase.from("message_reactions" as any) as any)
          .insert({
            community_id: communityId,
            message_id: messageId,
            user_id: user.id,
            emoji
          });
        if (error) {
          throw new Error(readableSupabaseError(error.message));
        }
      }

      return loadCommunityMessage(communityId, messageId);
    },

    subscribeToCommunityMessages(communityId, onChange) {
      const channel = supabase
        .channel(`community-messages-${communityId}`)
        .on(
          "postgres_changes" as any,
          { event: "INSERT", schema: "public", table: "community_messages", filter: `community_id=eq.${communityId}` } as any,
          onChange
        )
        .on(
          "postgres_changes" as any,
          { event: "*", schema: "public", table: "message_reactions", filter: `community_id=eq.${communityId}` } as any,
          onChange
        )
        .subscribe();

      return () => {
        void supabase.removeChannel(channel);
      };
    },

    addOneSecondLog,
    deleteOneSecondLog,

    async saveState(state) {
      if (state.currentUser) {
        writeRelationshipOverlay(state.currentUser.id, state.communities);
      }
    },

    async resetState() {
      return loadState();
    },

    async signIn(credentials) {
      if (!credentials) {
        throw new Error("이메일과 비밀번호를 입력해 주세요.");
      }

      const email = credentials.email.trim();
      const password = credentials.password;

      if (credentials.mode === "signUp") {
        const displayName = credentials.displayName?.trim() || email.split("@")[0] || "New member";
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: displayName
            },
            emailRedirectTo: window.location.origin
          }
        });

        if (error) {
          throw new Error(readableSupabaseError(error.message));
        }
        if (!data.session) {
          throw new Error("확인 이메일을 보냈습니다. 이메일 인증 후 로그인해 주세요.");
        }
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) {
        throw new Error(readableSupabaseError(error.message));
      }
    },

    async getAvailableOAuthProviders() {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !anonKey) return [];

      const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
        headers: {
          apikey: anonKey
        }
      });
      if (!response.ok) {
        throw new Error("간편 로그인 설정을 확인하지 못했습니다.");
      }

      const settings = await response.json() as { external?: Record<string, boolean> };
      const providers: OAuthProvider[] = ["google", "kakao", "naver", "apple"];
      const configuredProviders = new Set(
        (import.meta.env.VITE_OAUTH_PROVIDERS ?? "")
          .split(",")
          .map((provider) => provider.trim())
          .filter(Boolean)
      );
      return providers.filter(
        (provider) =>
          settings.external?.[supabaseOAuthProvider(provider)] === true || configuredProviders.has(provider)
      );
    },

    async signInWithOAuth(provider) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: supabaseOAuthProvider(provider),
        options: {
          redirectTo: authRedirectUrl()
        }
      });
      if (error) {
        throw new Error(readableSupabaseError(error.message));
      }
    },

    subscribeToAuthState(onChange) {
      const { data } = supabase.auth.onAuthStateChange((event) => {
        const normalized = normalizeAuthChangeEvent(event);
        if (!normalized) return;
        window.setTimeout(() => onChange(normalized), 0);
      });

      return () => data.subscription.unsubscribe();
    },

    async signOut() {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw new Error(error.message);
      }
    },

    async resetPassword(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: authRedirectUrl("recovery")
      });
      if (error) {
        throw new Error(readableSupabaseError(error.message));
      }
    },

    async updatePassword(password) {
      await requireUser();
      const { error } = await supabase.auth.updateUser({
        password
      });
      if (error) {
        throw new Error(readableSupabaseError(error.message));
      }
    },

    async updateProfile(input) {
      const user = await requireUser();
      const name = input.name.trim();
      const handle = normalizeHandle(input.handle);

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          name
        }
      });
      if (authError) {
        throw new Error(readableSupabaseError(authError.message));
      }

      await one<ProfileRow>(
        supabase
          .from("profiles")
          .update({
            display_name: name,
            handle
          })
          .eq("id", user.id)
          .select(profileSelect)
          .single()
      );
    },

    async findCommunityByInviteCode() {
      return null;
    },

    async joinCommunityWithInviteCode(inviteCode: string) {
      const { data, error } = await supabase.rpc("join_community_with_invite_code", {
        p_code: inviteCode.trim().toUpperCase()
      });

      if (error) {
        if (error.message.includes("invalid_invite_code")) {
          return null;
        }
        throw new Error(readableSupabaseError(error.message));
      }

      return loadCommunity(String(data));
    },

    async createCommunity(input) {
      const { data, error } = await supabase.rpc("create_community", {
        p_name: input.name,
        p_description: input.description,
        p_accent: input.accent
      });

      if (error) {
        throw new Error(readableSupabaseError(error.message));
      }

      return loadCommunity(String(data));
    },

    async updateCommunity(communityId, input) {
      await requireUser();

      let coverUrl = input.coverUrl;
      if (input.coverFile) {
        const fileExt = input.coverFile.name.split(".").pop();
        const filePath = `${communityId}/cover-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("cover-images")
          .upload(filePath, input.coverFile, { 
            contentType: input.coverFile.type || "image/jpeg",
            upsert: true 
          });

        if (uploadError) {
          throw new Error(`배경 이미지 업로드 실패: ${uploadError.message}`);
        }

        const { data } = supabase.storage.from("cover-images").getPublicUrl(filePath);
        coverUrl = data.publicUrl;
      }

      await one<CommunityRow>(
        supabase
          .from("communities")
          .update({
            name: input.name,
            description: input.description,
            accent: input.accent,
            cover_url: coverUrl || null
          })
          .eq("id", communityId)
          .select(communitySelect)
          .single()
      );

      return loadCommunity(communityId);
    },

    async setCommunityContentModules(communityId, modules) {
      const user = await requireUser();
      const normalizedModules = normalizeStoredCommunityModules(modules);

      try {
        const { error: deleteError } = await (supabase.from("community_content_modules" as any) as any)
          .delete()
          .eq("community_id", communityId);

        if (deleteError) {
          throw new Error(deleteError.message);
        }

        if (!normalizedModules.length) {
          return [];
        }

        const insertedRows = await rows<CommunityContentModuleRow>(
          (supabase.from("community_content_modules" as any) as any)
            .insert(
              normalizedModules.map((module) => ({
                community_id: communityId,
                module,
                enabled_by: user.id
              }))
            )
            .select(contentModuleSelect)
        );

        return normalizeStoredCommunityModules(insertedRows.map((row) => row.module));
      } catch (error) {
        if (isMissingContentModuleTable(error)) {
          return normalizedModules;
        }

        throw error;
      }
    },

    async regenerateInviteCode(communityId) {
      await requireUser();
      const { data, error } = await supabase.rpc("regenerate_invite_code", {
        p_community_id: communityId
      });

      if (error) {
        throw new Error(readableSupabaseError(error.message));
      }

      return String(data);
    },

    async addEvent(communityId, event) {
      return executeMutation(
        "addEvent",
        [communityId, event],
        async () => {
          const user = await requireUser();
          const row = await one<CalendarEventRow>(
            supabase
              .from("calendar_events")
              .insert({
                community_id: communityId,
                title: event.title,
                notes: event.notes,
                location: event.location,
                starts_at: event.startsAt,
                created_by: user.id
              })
              .select(eventSelect)
              .single()
          );

          return mapEvent(row);
        },
        () => ({
          ...event,
          id: createId("event"),
          createdAt: new Date().toISOString()
        })
      );
    },

    async addAlbum(communityId, album) {
      return executeMutation(
        "addAlbum",
        [communityId, album],
        async () => {
          const user = await requireUser();
          const row = await one<AlbumRow>(
            supabase
              .from("albums")
              .insert({
                community_id: communityId,
                title: album.title,
                description: album.description,
                created_by: user.id
              })
              .select(albumSelect)
              .single()
          );

          return {
            ...mapAlbum(row, new Map(), new Map(), new Map()),
            items: []
          };
        },
        () => ({
          id: createId("album"),
          title: album.title,
          description: album.description,
          createdAt: new Date().toISOString(),
          items: []
        })
      );
    },

    async addAlbumItem(communityId, albumId, input: AlbumItemInput) {
      const user = await requireUser();
      const profile = await ensureCurrentProfile(user);
      return executeMutation(
        "addAlbumItem",
        [communityId, albumId, input],
        async () => {
          const mediaPaths = input.files && input.files.length > 0
            ? await Promise.all(input.files.map((f) => uploadAlbumMedia(communityId, albumId, user.id, f)))
            : [];
          const mediaUrlString = mediaPaths.length > 0 ? mediaPaths.join(",") : null;
          const row = await one<AlbumItemRow>(
            supabase
              .from("album_items")
              .insert({
                community_id: communityId,
                album_id: albumId,
                title: input.title,
                kind: mediaUrlString ? (input.kind === "video" ? "video" : "photo") : input.kind,
                media_url: mediaUrlString,
                created_by: user.id
              })
              .select(albumItemSelect)
              .single()
          );

          const mediaUrls = await createAlbumMediaUrls([row]);
          return mapAlbumItem(row, new Map([[profile.id, profile]]), mediaUrls);
        },
        () => {
          const mediaUrl = input.files && input.files.length > 0
            ? input.files.map((f) => URL.createObjectURL(f)).join(",")
            : undefined;
          return {
            id: createId("albumItem"),
            albumId,
            title: input.title,
            kind: mediaUrl ? (input.kind === "video" ? "video" : "photo") : input.kind,
            mediaUrl,
            ownerId: user.id,
            ownerName: profile.display_name,
            createdAt: new Date().toISOString()
          };
        }
      );
    },

    async addDDay(communityId, dday) {
      return executeMutation(
        "addDDay",
        [communityId, dday],
        async () => {
          const user = await requireUser();
          const row = await one<DDayRow>(
            supabase
              .from("ddays")
              .insert({
                community_id: communityId,
                title: dday.title,
                target_date: toDateOnly(dday.targetDate),
                kind: ddayKindValues[dday.kind],
                note: dday.note,
                created_by: user.id
              })
              .select(ddaySelect)
              .single()
          );

          return mapDDay(row);
        },
        () => ({
          id: createId("dday"),
          title: dday.title,
          targetDate: dday.targetDate,
          kind: dday.kind,
          note: dday.note || ""
        })
      );
    },

    async addPair(communityId, pair) {
      const user = await requireUser();
      try {
        const row = await one<RelationshipPairRow>(
          supabase
            .from("relationship_pairs")
            .insert({
              community_id: communityId,
              first_member_id: pair.memberIds[0],
              second_member_id: pair.memberIds[1],
              label: pair.label,
              created_by: user.id
            })
            .select(relationshipPairSelect)
            .single()
        );

        return mapRelationshipPair(row);
      } catch (error) {
        if (isMissingRelationshipTables(error)) {
          return {
            ...pair,
            id: createId("pair"),
            createdAt: new Date().toISOString()
          };
        }

        throw error;
      }
    },

    async addCircle(communityId, circle) {
      const user = await requireUser();
      try {
        const row = await one<CircleRow>(
          supabase
            .from("circles")
            .insert({
              community_id: communityId,
              name: circle.name,
              created_by: user.id
            })
            .select(circleSelect)
            .single()
        );

        if (circle.memberIds.length) {
          await rows<CircleMemberRow>(
            supabase
              .from("circle_members")
              .insert(
                circle.memberIds.map((memberId) => ({
                  community_id: communityId,
                  circle_id: row.id,
                  member_id: memberId
                }))
              )
              .select(circleMemberSelect)
          );
        }

        return mapCircle(row, new Map([[row.id, circle.memberIds.map((memberId) => ({
          circle_id: row.id,
          member_id: memberId
        }))]]));
      } catch (error) {
        if (isMissingRelationshipTables(error)) {
          return {
            ...circle,
            id: createId("circle"),
            createdAt: new Date().toISOString()
          };
        }

        throw error;
      }
    },

    async addCommitment(communityId, commitment) {
      const user = await requireUser();
      return executeMutation(
        "addCommitment",
        [communityId, commitment],
        async () => {
          const visibilityColumns = commitmentVisibilityColumns(commitment.visibility);
          const row = await one<CommitmentRow>(
            supabase
              .from("commitments")
              .insert({
                community_id: communityId,
                title: commitment.title,
                note: commitment.note,
                due_at: commitment.dueAt,
                visibility_type: visibilityColumns.visibility_type,
                pair_id: visibilityColumns.pair_id,
                circle_id: visibilityColumns.circle_id,
                created_by: user.id
              })
              .select(commitmentSelect)
              .single()
          );

          if (commitment.assigneeIds.length) {
            await rows<CommitmentAssigneeRow>(
              supabase
                .from("commitment_assignees")
                .insert(
                  commitment.assigneeIds.map((memberId) => ({
                    community_id: communityId,
                    commitment_id: row.id,
                    member_id: memberId
                  }))
                )
                .select(commitmentAssigneeSelect)
            );
          }

          return mapCommitment(row, new Map([[row.id, commitment.assigneeIds.map((memberId) => ({
            commitment_id: row.id,
            member_id: memberId
          }))]]));
        },
        () => ({
          ...commitment,
          id: createId("commitment"),
          status: "open",
          createdAt: new Date().toISOString(),
          createdByUserId: user.id
        })
      );
    },

    async addNotice(communityId, notice) {
      return executeMutation(
        "addNotice",
        [communityId, notice],
        async () => {
          const user = await requireUser();
          const row = await one<NoticeRow>(
            supabase
              .from("notices")
              .insert({
                community_id: communityId,
                title: notice.title,
                body: notice.body,
                pinned: notice.pinned,
                created_by: user.id
              })
              .select(noticeSelect)
              .single()
          );

          return mapNotice(row);
        },
        () => ({
          ...notice,
          id: createId("notice"),
          createdAt: new Date().toISOString()
        })
      );
    },

    async updateEvent(communityId, eventId, event) {
      await requireUser();
      const row = await one<CalendarEventRow>(
        supabase
          .from("calendar_events")
          .update({
            title: event.title,
            notes: event.notes,
            location: event.location,
            starts_at: event.startsAt
          })
          .eq("community_id", communityId)
          .eq("id", eventId)
          .select(eventSelect)
          .single()
      );

      return mapEvent(row);
    },

    async updateAlbum(communityId, albumId, album) {
      await requireUser();
      const row = await one<AlbumRow>(
        supabase
          .from("albums")
          .update({
            title: album.title,
            description: album.description
          })
          .eq("community_id", communityId)
          .eq("id", albumId)
          .select(albumSelect)
          .single()
      );

      return {
        ...mapAlbum(row, new Map(), new Map(), new Map()),
        items: []
      };
    },

    async updateAlbumItem(communityId, albumId, itemId, input: AlbumItemUpdateInput) {
      const user = await requireUser();
      const profile = await ensureCurrentProfile(user);
      const existing = await maybeOne<AlbumItemRow>(
        supabase.from("album_items").select(albumItemSelect).eq("id", itemId).maybeSingle()
      );
      const mediaPaths = input.files && input.files.length > 0
        ? await Promise.all(input.files.map((f) => uploadAlbumMedia(communityId, albumId, user.id, f)))
        : [];
      const mediaUrlString = mediaPaths.length > 0 ? mediaPaths.join(",") : null;
      const changes: { title: string; kind?: "photo"; media_url?: string } = {
        title: input.title
      };

      if (mediaUrlString) {
        changes.kind = "photo";
        changes.media_url = mediaUrlString;
      }

      const row = await one<AlbumItemRow>(
        supabase
          .from("album_items")
          .update(changes)
          .eq("community_id", communityId)
          .eq("album_id", albumId)
          .eq("id", itemId)
          .select(albumItemSelect)
          .single()
      );

      if (mediaPaths.length > 0 && existing?.media_url) {
        const oldPaths = existing.media_url.split(",");
        await supabase.storage.from("album-media").remove(oldPaths);
      }

      const mediaUrls = await createAlbumMediaUrls([row]);
      return mapAlbumItem(row, new Map([[profile.id, profile]]), mediaUrls);
    },

    async updateDDay(communityId, ddayId, dday) {
      await requireUser();
      const row = await one<DDayRow>(
        supabase
          .from("ddays")
          .update({
            title: dday.title,
            target_date: toDateOnly(dday.targetDate),
            kind: ddayKindValues[dday.kind],
            note: dday.note
          })
          .eq("community_id", communityId)
          .eq("id", ddayId)
          .select(ddaySelect)
          .single()
      );

      return mapDDay(row);
    },

    async updateNotice(communityId, noticeId, notice) {
      await requireUser();
      const row = await one<NoticeRow>(
        supabase
          .from("notices")
          .update({
            title: notice.title,
            body: notice.body,
            pinned: notice.pinned
          })
          .eq("community_id", communityId)
          .eq("id", noticeId)
          .select(noticeSelect)
          .single()
      );

      return mapNotice(row);
    },

    async updateMemberRole(communityId, memberId, role) {
      await requireUser();
      const row = await one<CommunityMemberRow>(
        supabase.rpc("update_community_member_role", {
          p_community_id: communityId,
          p_member_id: memberId,
          p_role: role
        })
      );
      const profiles = await loadProfiles([row.user_id]);

      return mapMember(row, profiles);
    },

    async deleteEvent(communityId, eventId) {
      await requireUser();
      const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("community_id", communityId)
        .eq("id", eventId);

      if (error) {
        throw new Error(error.message);
      }
    },

    async deleteAlbum(communityId, albumId) {
      await requireUser();
      const mediaItems = await rows<{ media_url: string | null }>(
        supabase
          .from("album_items")
          .select("media_url")
          .eq("community_id", communityId)
          .eq("album_id", albumId)
      );
      const { error } = await supabase
        .from("albums")
        .delete()
        .eq("community_id", communityId)
        .eq("id", albumId);

      if (error) {
        throw new Error(error.message);
      }

      const mediaPaths = mediaItems.map((item) => item.media_url).filter(Boolean) as string[];
      if (mediaPaths.length) {
        await supabase.storage.from("album-media").remove(mediaPaths);
      }
    },

    async deleteAlbumItem(communityId, albumId, itemId) {
      await requireUser();
      const existing = await maybeOne<{ media_url: string | null }>(
        supabase
          .from("album_items")
          .select("media_url")
          .eq("community_id", communityId)
          .eq("album_id", albumId)
          .eq("id", itemId)
          .maybeSingle()
      );

      const { error } = await supabase
        .from("album_items")
        .delete()
        .eq("community_id", communityId)
        .eq("album_id", albumId)
        .eq("id", itemId);

      if (error) {
        throw new Error(error.message);
      }

      if (existing?.media_url) {
        await supabase.storage.from("album-media").remove([existing.media_url]);
      }
    },

    async deleteDDay(communityId, ddayId) {
      await requireUser();
      const { error } = await supabase
        .from("ddays")
        .delete()
        .eq("community_id", communityId)
        .eq("id", ddayId);

      if (error) {
        throw new Error(error.message);
      }
    },

    async deleteNotice(communityId, noticeId) {
      await requireUser();
      const { error } = await supabase
        .from("notices")
        .delete()
        .eq("community_id", communityId)
        .eq("id", noticeId);

      if (error) {
        throw new Error(error.message);
      }
    },

    async toggleCommitment(communityId, commitmentId) {
      await requireUser();
      try {
        const existing = await one<CommitmentRow>(
          supabase
            .from("commitments")
            .select(commitmentSelect)
            .eq("community_id", communityId)
            .eq("id", commitmentId)
            .single()
        );
        const nextStatus = existing.status === "done" ? "open" : "done";
        const row = await one<CommitmentRow>(
          supabase
            .from("commitments")
            .update({
              status: nextStatus,
              completed_at: nextStatus === "done" ? new Date().toISOString() : null
            })
            .eq("community_id", communityId)
            .eq("id", commitmentId)
            .select(commitmentSelect)
            .single()
        );
        const assignees = await rows<CommitmentAssigneeRow>(
          supabase
            .from("commitment_assignees")
            .select(commitmentAssigneeSelect)
            .eq("community_id", communityId)
            .eq("commitment_id", commitmentId)
        );

        return mapCommitment(row, groupBy(assignees, (assignee) => assignee.commitment_id));
      } catch (error) {
        if (isMissingRelationshipTables(error)) {
          const existing = (await loadState()).communities
            .find((community) => community.id === communityId)
            ?.commitments.find((commitment) => commitment.id === commitmentId);
          if (!existing) {
            throw new Error("약속을 찾지 못했습니다.");
          }

          return {
            ...existing,
            status: existing.status === "done" ? "open" : "done",
            completedAt: existing.status === "done" ? undefined : new Date().toISOString()
          };
        }

        throw error;
      }
    },

    async deleteCommitment(communityId, commitmentId) {
      await requireUser();
      const { error } = await supabase
        .from("commitments")
        .delete()
        .eq("community_id", communityId)
        .eq("id", commitmentId);

      if (error && !isMissingRelationshipTables(error)) {
        throw new Error(error.message);
      }
    },

    async deleteCommunity(communityId) {
      await requireUser();
      const mediaItems = await rows<{ media_url: string | null }>(
        supabase
          .from("album_items")
          .select("media_url")
          .eq("community_id", communityId)
      );
      const mediaPaths = mediaItems.map((item) => item.media_url).filter(Boolean) as string[];

      if (mediaPaths.length) {
        await supabase.storage.from("album-media").remove(mediaPaths);
      }

      const { error } = await supabase
        .from("communities")
        .delete()
        .eq("id", communityId);

      if (error) {
        throw new Error(error.message);
      }
    },

    async removeMember(communityId, memberId) {
      await requireUser();
      const { error } = await supabase.rpc("remove_community_member", {
        p_community_id: communityId,
        p_member_id: memberId
      });

      if (error) {
        throw new Error(readableSupabaseError(error.message));
      }
    },

    async createNotification(kind, title, body, communityId) {
      const user = await requireUser();
      const row = await one<NotificationRow>(
        supabase
          .from("notifications")
          .insert({
            user_id: user.id,
            community_id: communityId,
            kind: kind === "1s" || kind === "nudge" ? "notice" : kind,
            title,
            body
          })
          .select(notificationSelect)
          .single()
      );

      return mapNotification(row);
    },

    async notifyCommunityMembers(communityId, kind, title, body, options) {
      await requireUser();
      const excludeCurrentUser = options?.excludeCurrentUser ?? true;
      const { error: rpcError } = await supabase.rpc("create_community_notifications", {
        p_community_id: communityId,
        p_kind: kind === "1s" || kind === "nudge" ? "notice" : kind,
        p_title: title,
        p_body: body,
        p_exclude_current_user: excludeCurrentUser
      });

      if (rpcError) {
        throw new Error(readableSupabaseError(rpcError.message));
      }

      const { error: pushError } = await supabase.functions.invoke("send-push", {
        body: {
          communityId,
          excludeCurrentUser,
          title,
          body,
          url: options?.url ?? "/",
          tag: options?.tag ?? `copula-${kind}-${communityId}`
        }
      });

      if (pushError) {
        throw new Error(readableSupabaseError(pushError.message));
      }
    },

    async markNotificationRead(notificationId) {
      const user = await requireUser();
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("user_id", user.id)
        .is("read_at", null);

      if (error) {
        throw new Error(error.message);
      }
    },

    async markNotificationsRead() {
      const user = await requireUser();
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("read_at", null);

      if (error) {
        throw new Error(error.message);
      }
    },

    async savePushSubscription(subscription: PushSubscriptionPayload) {
      const user = await requireUser();
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          user_agent: subscription.userAgent ?? navigator.userAgent,
          updated_at: new Date().toISOString()
        },
        { onConflict: "user_id,endpoint" }
      );

      if (error) {
        throw new Error(error.message);
      }
    }
  };

  async function syncOfflineMutations() {
    if (!navigator.onLine) return;
    const queue = await getSyncQueue();
    if (!queue.length) return;

    console.log(`Syncing ${queue.length} offline mutations to Supabase...`);
    for (const item of queue) {
      try {
        if (item.action === "addNotice" && repo.addNotice) {
          await repo.addNotice(item.args[0], item.args[1]);
        } else if (item.action === "addEvent" && repo.addEvent) {
          await repo.addEvent(item.args[0], item.args[1]);
        } else if (item.action === "addAlbum" && repo.addAlbum) {
          await repo.addAlbum(item.args[0], item.args[1]);
        } else if (item.action === "addAlbumItem" && repo.addAlbumItem) {
          await repo.addAlbumItem(item.args[0], item.args[1], item.args[2]);
        } else if (item.action === "addDDay" && repo.addDDay) {
          await repo.addDDay(item.args[0], item.args[1]);
        } else if (item.action === "addCommitment" && repo.addCommitment) {
          await repo.addCommitment(item.args[0], item.args[1]);
        } else if (item.action === "toggleCommitment" && repo.toggleCommitment) {
          await repo.toggleCommitment(item.args[0], item.args[1]);
        } else if (item.action === "deleteNotice" && repo.deleteNotice) {
          await repo.deleteNotice(item.args[0], item.args[1]);
        } else if (item.action === "deleteEvent" && repo.deleteEvent) {
          await repo.deleteEvent(item.args[0], item.args[1]);
        } else if (item.action === "deleteAlbum" && repo.deleteAlbum) {
          await repo.deleteAlbum(item.args[0], item.args[1]);
        } else if (item.action === "deleteAlbumItem" && repo.deleteAlbumItem) {
          await repo.deleteAlbumItem(item.args[0], item.args[1], item.args[2]);
        } else if (item.action === "deleteDDay" && repo.deleteDDay) {
          await repo.deleteDDay(item.args[0], item.args[1]);
        } else if (item.action === "deleteCommitment" && repo.deleteCommitment) {
          await repo.deleteCommitment(item.args[0], item.args[1]);
        }
        
        if (item.id !== undefined) {
          await removeSyncQueueItem(item.id);
        }
      } catch (err) {
        console.error(`Failed to sync action ${item.action}:`, err);
        break;
      }
    }
  }

  if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
      syncOfflineMutations().catch(console.error);
    });
    if (navigator.onLine) {
      syncOfflineMutations().catch(console.error);
    }
  }

  return repo;
}

async function rows<T>(query: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>) {
  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as T[];
}

async function one<T>(query: PromiseLike<{ data: unknown | null; error: { message: string } | null }>) {
  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("데이터를 불러오지 못했습니다.");
  }

  return data as T;
}

async function maybeOne<T>(query: PromiseLike<{ data: unknown | null; error: { message: string } | null }>) {
  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return data as T | null;
}

function mapProfile(profile: ProfileRow): UserProfile {
  return {
    id: profile.id,
    name: profile.display_name,
    handle: profile.handle,
    initials: initials(profile.display_name),
    avatarUrl: profile.avatar_url || undefined
  };
}

function overlayStorageKey(userId: string) {
  return `${relationshipOverlayKey}.${userId}`;
}

function readRelationshipOverlay(userId: string): Record<string, RelationshipOverlayEntry> {
  try {
    const saved = localStorage.getItem(overlayStorageKey(userId));
    if (!saved) return {};
    return JSON.parse(saved) as Record<string, RelationshipOverlayEntry>;
  } catch {
    return {};
  }
}

function writeRelationshipOverlay(userId: string, communities: Community[]) {
  const overlay = communities.reduce<Record<string, RelationshipOverlayEntry>>((items, community) => {
    items[community.id] = {
      pairs: community.pairs ?? [],
      circles: community.circles ?? [],
      commitments: community.commitments ?? []
    };
    return items;
  }, {});

  localStorage.setItem(overlayStorageKey(userId), JSON.stringify(overlay));
}

function mergeRelationshipOverlay(userId: string, communities: Community[]) {
  const overlay = readRelationshipOverlay(userId);
  return communities.map((community) => ({
    ...community,
    pairs: overlay[community.id]?.pairs ?? community.pairs ?? [],
    circles: overlay[community.id]?.circles ?? community.circles ?? [],
    commitments: overlay[community.id]?.commitments ?? community.commitments ?? []
  }));
}

type CommunityNested = Omit<
  Community,
  "id" | "name" | "description" | "accent" | "coverUrl" | "createdAt" | "pairs" | "circles" | "commitments" | "messages"
> &
  Partial<Pick<Community, "pairs" | "circles" | "commitments" | "messages">>;

function mapCommunity(
  row: CommunityRow,
  nested: CommunityNested
): Community {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    inviteCode: nested.inviteCode,
    accent: row.accent,
    coverUrl: row.cover_url || null,
    createdAt: row.created_at,
    contentModules: nested.contentModules,
    members: nested.members,
    events: nested.events,
    albums: nested.albums,
    ddays: nested.ddays,
    notices: nested.notices,
    pairs: nested.pairs ?? [],
    circles: nested.circles ?? [],
    commitments: nested.commitments ?? [],
    messages: nested.messages ?? [],
    oneSecondLogs: nested.oneSecondLogs
  };
}

function mapMember(row: CommunityMemberRow, profiles: Map<string, ProfileRow>): CommunityMember {
  const profile = profiles.get(row.user_id);
  const name = profile?.display_name ?? "멤버";

  return {
    id: row.id,
    userId: row.user_id,
    name,
    handle: profile?.handle ?? "@member",
    initials: initials(name),
    role: row.role,
    joinedAt: row.joined_at
  };
}

function mapEvent(row: CalendarEventRow): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    location: row.location,
    startsAt: row.starts_at,
    createdAt: row.created_at
  };
}

function mapAlbum(
  row: AlbumRow,
  albumItemsByAlbum: Map<string, AlbumItemRow[]>,
  profiles: Map<string, ProfileRow>,
  mediaUrls: Map<string, string>
): Album {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    createdAt: row.created_at,
    items: (albumItemsByAlbum.get(row.id) ?? []).map((item) => mapAlbumItem(item, profiles, mediaUrls))
  };
}

function mapAlbumItem(
  row: AlbumItemRow,
  profiles: Map<string, ProfileRow>,
  mediaUrls: Map<string, string>
): AlbumItem {
  const urls: string[] = [];
  if (row.media_url) {
    row.media_url.split(",").forEach((p) => {
      const trimmed = p.trim();
      const signed = mediaUrls.get(trimmed);
      if (signed) urls.push(signed);
    });
  }
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    mediaUrl: urls.length > 0 ? urls.join(",") : undefined,
    ownerName: profiles.get(row.created_by)?.display_name ?? "멤버",
    createdAt: row.created_at
  };
}

function mapDDay(row: DDayRow): DDayItem {
  return {
    id: row.id,
    title: row.title,
    targetDate: new Date(`${row.target_date}T09:00:00`).toISOString(),
    kind: ddayKindLabels[row.kind],
    note: row.note
  };
}

function mapNotice(row: NoticeRow): Notice {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    pinned: row.pinned,
    createdAt: row.created_at
  };
}

function mapRelationshipPair(row: RelationshipPairRow): RelationshipPair {
  return {
    id: row.id,
    memberIds: [row.first_member_id, row.second_member_id],
    label: row.label,
    createdAt: row.created_at
  };
}

function mapCircle(
  row: CircleRow,
  circleMembersByCircle: Map<string, CircleMemberRow[]>
): Circle {
  return {
    id: row.id,
    name: row.name,
    memberIds: (circleMembersByCircle.get(row.id) ?? []).map((member) => member.member_id),
    createdAt: row.created_at
  };
}

function mapCommitment(
  row: CommitmentRow,
  assigneesByCommitment: Map<string, CommitmentAssigneeRow[]>
): Commitment {
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    dueAt: row.due_at,
    status: row.status,
    assigneeIds: (assigneesByCommitment.get(row.id) ?? []).map((assignee) => assignee.member_id),
    visibility: mapCommitmentVisibility(row),
    createdAt: row.created_at,
    createdByUserId: row.created_by,
    completedAt: row.completed_at ?? undefined
  };
}

function mapCommitmentVisibility(row: CommitmentRow): Commitment["visibility"] {
  if (row.visibility_type === "pair" && row.pair_id) {
    return { type: "pair", pairId: row.pair_id };
  }
  if (row.visibility_type === "circle" && row.circle_id) {
    return { type: "circle", circleId: row.circle_id };
  }
  if (row.visibility_type === "private") {
    return { type: "private" };
  }
  return { type: "community" };
}

function mapCommunityMessage(
  row: CommunityMessageRow,
  profiles: Map<string, ProfileRow>,
  reactionsByMessage: Map<string, MessageReactionRow[]>
): CommunityMessage {
  const profile = profiles.get(row.sender_user_id);
  const name = profile?.display_name ?? "멤버";

  return {
    id: row.id,
    communityId: row.community_id,
    senderUserId: row.sender_user_id,
    senderMemberId: row.sender_member_id,
    senderName: name,
    senderInitials: initials(name),
    body: row.body,
    createdAt: row.created_at,
    reactions: (reactionsByMessage.get(row.id) ?? []).map((reaction) => ({
      id: reaction.id,
      messageId: reaction.message_id,
      userId: reaction.user_id,
      emoji: reaction.emoji,
      createdAt: reaction.created_at
    }))
  };
}

function commitmentVisibilityColumns(visibility: Commitment["visibility"]) {
  if (visibility.type === "pair") {
    return {
      visibility_type: "pair" as const,
      pair_id: visibility.pairId,
      circle_id: null
    };
  }
  if (visibility.type === "circle") {
    return {
      visibility_type: "circle" as const,
      pair_id: null,
      circle_id: visibility.circleId
    };
  }
  return {
    visibility_type: visibility.type,
    pair_id: null,
    circle_id: null
  };
}

function isMissingRelationshipTables(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const looksMissing =
    message.includes("does not exist") ||
    message.includes("Could not find the table") ||
    message.includes("PGRST205");
  if (!looksMissing) {
    return false;
  }

  return [
    "relationship_pairs",
    "circles",
    "circle_members",
    "commitments",
    "commitment_assignees"
  ].some((tableName) => message.includes(tableName));
}

function isMissingMessageTables(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const looksMissing =
    message.includes("does not exist") ||
    message.includes("Could not find the table") ||
    message.includes("PGRST205");
  if (!looksMissing) {
    return false;
  }

  return ["community_messages", "message_reactions"].some((tableName) => message.includes(tableName));
}

function isMissingContentModuleTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const looksMissing =
    message.includes("does not exist") ||
    message.includes("Could not find the table") ||
    message.includes("PGRST205");
  return looksMissing && message.includes("community_content_modules");
}

function normalizeStoredCommunityModules(modules: unknown): CommunityModule[] {
  const storedModules: CommunityModule[] = ["calendar", "commitments", "relationships", "albums", "1s", "budget"];
  if (!Array.isArray(modules)) return [];
  const moduleSet = new Set(
    modules.filter((module): module is CommunityModule =>
      typeof module === "string" && storedModules.includes(module as CommunityModule)
    )
  );
  return storedModules.filter((module) => moduleSet.has(module));
}

function mapNotification(row: NotificationRow): CopulaNotification {
  return {
    id: row.id,
    kind: row.title === "콕 찌르기 ⚡️" ? "nudge" : row.kind,
    communityId: row.community_id ?? undefined,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    read: Boolean(row.read_at)
  };
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce((groups, item) => {
    const key = getKey(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
    return groups;
  }, new Map<string, T[]>());
}

function firstBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce((groups, item) => {
    const key = getKey(item);
    if (!groups.has(key)) {
      groups.set(key, item);
    }
    return groups;
  }, new Map<string, T>());
}

function profileNameFromUser(user: User) {
  const metadata = user.user_metadata;
  const rawName = metadata.name ?? metadata.full_name ?? user.email?.split("@")[0] ?? "New member";
  return String(rawName).trim().slice(0, 80) || "New member";
}

function profileHandleFromId(userId: string) {
  return `@${userId.replace(/-/g, "").slice(0, 12)}`;
}

function normalizeHandle(handle: string) {
  const trimmed = handle.trim();
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

function toDateOnly(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

async function createAlbumMediaUrls(items: AlbumItemRow[]) {
  const paths: string[] = [];
  items.forEach((item) => {
    if (item.media_url) {
      item.media_url.split(",").forEach((p) => {
        const trimmed = p.trim();
        if (trimmed) paths.push(trimmed);
      });
    }
  });

  const uniquePaths = [...new Set(paths)];
  const mediaUrls = new Map<string, string>();
  if (!uniquePaths.length) {
    return mediaUrls;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage.from("album-media").createSignedUrls(uniquePaths, 60 * 60);
  if (error) {
    return mediaUrls;
  }

  data.forEach((item) => {
    if (item.path && item.signedUrl) {
      mediaUrls.set(item.path, item.signedUrl);
    }
  });

  return mediaUrls;
}

async function uploadAlbumMedia(communityId: string, albumId: string, userId: string, file: File) {
  const supabase = getSupabaseClient();
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${communityId}/${userId}/${albumId}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("album-media").upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false
  });

  if (error) {
    throw new Error(error.message);
  }

  return path;
}

function readableSupabaseError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }
  if (normalized.includes("email not confirmed")) {
    return "이메일 인증을 완료한 뒤 로그인해 주세요.";
  }
  if (normalized.includes("user already registered")) {
    return "이미 가입된 이메일입니다.";
  }
  if (normalized.includes("password should be at least") || normalized.includes("weak password")) {
    return "비밀번호는 6자 이상으로 입력해 주세요.";
  }
  if (normalized.includes("rate limit") || normalized.includes("too many requests")) {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (normalized.includes("provider is not enabled") || normalized.includes("unsupported provider")) {
    return "아직 사용할 수 없는 간편 로그인입니다.";
  }
  if (message.includes("auth_required")) {
    return "로그인이 필요합니다.";
  }
  if (message.includes("invalid_invite_code")) {
    return "유효하지 않은 초대 코드입니다.";
  }
  if (message.includes("not_member")) {
    return "copula 멤버 정보를 찾지 못했습니다.";
  }
  if (message.includes("community_not_found")) {
    return "copula 정보를 찾지 못했습니다.";
  }
  if (message.includes("member_not_found")) {
    return "멤버 정보를 찾지 못했습니다.";
  }
  if (message.includes("insufficient_permission")) {
    return "권한이 없습니다.";
  }
  if (message.includes("owner_only")) {
    return "소유자 권한이 필요합니다.";
  }
  if (message.includes("last_owner_cannot_change")) {
    return "마지막 소유자의 역할은 변경할 수 없습니다.";
  }
  if (message.includes("last_owner_cannot_leave")) {
    return "마지막 소유자는 copula를 나갈 수 없습니다.";
  }
  if (message.includes("last_owner_cannot_remove")) {
    return "마지막 소유자는 내보낼 수 없습니다.";
  }

  return message;
}

function supabaseOAuthProvider(provider: OAuthProvider): Provider {
  return provider === "naver" ? "custom:naver" : provider;
}

function authRedirectUrl(type?: "recovery") {
  const url = new URL("/", window.location.origin);
  const inviteCode = new URL(window.location.href).searchParams.get("invite");
  if (inviteCode) url.searchParams.set("invite", inviteCode);
  if (type) url.searchParams.set("type", type);
  return url.toString();
}

function normalizeAuthChangeEvent(event: AuthChangeEvent): AuthStateChangeEvent | null {
  if (event === "SIGNED_IN" || event === "USER_UPDATED") return "signedIn";
  if (event === "SIGNED_OUT") return "signedOut";
  if (event === "PASSWORD_RECOVERY") return "passwordRecovery";
  if (event === "TOKEN_REFRESHED") return "tokenRefreshed";
  return null;
}

async function createOneSecondVideoUrls(logs: OneSecondLogRow[]) {
  const paths = [...new Set(logs.map((log) => log.video_url).filter(Boolean))] as string[];
  const videoUrls = new Map<string, string>();
  if (!paths.length) {
    return videoUrls;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage.from("album-media").createSignedUrls(paths, 60 * 60);
  if (error) {
    return videoUrls;
  }

  data.forEach((item) => {
    if (item.path && item.signedUrl) {
      videoUrls.set(item.path, item.signedUrl);
    }
  });

  return videoUrls;
}

function mapOneSecondLog(
  log: OneSecondLogRow,
  profiles: Map<string, ProfileRow>,
  videoUrls: Map<string, string>
): OneSecondLog {
  const profile = profiles.get(log.user_id);
  const name = profile?.display_name ?? "멤버";

  return {
    id: log.id,
    communityId: log.community_id,
    userId: log.user_id,
    userName: name,
    userInitials: initials(name),
    videoUrl: videoUrls.get(log.video_url) ?? "",
    caption: log.caption,
    createdAt: log.created_at
  };
}
