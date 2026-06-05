import type {
  Album,
  AlbumItemInput,
  AlbumItem,
  AlbumItemUpdateInput,
  CalendarEvent,
  Circle,
  Community,
  CommunityMember,
  CommunityMessage,
  Commitment,
  CopulaNotification,
  CopulaState,
  DDayItem,
  Notice,
  NotificationKind,
  PushSubscriptionPayload,
  RelationshipPair,
  Role,
  OneSecondLog
} from "../types";

export type DataBackend = "local" | "supabase";

export interface AuthCredentials {
  mode: "signIn" | "signUp";
  email: string;
  password: string;
  displayName?: string;
}

export interface CopulaRepository {
  readonly backend: DataBackend;
  getInitialState(): CopulaState;
  loadState(): Promise<CopulaState>;
  saveState(state: CopulaState): Promise<void>;
  resetState(): Promise<CopulaState>;
  findCommunityByInviteCode(inviteCode: string): Promise<Community | null>;
  signIn?(credentials?: AuthCredentials): Promise<void>;
  signOut?(): Promise<void>;
  resetPassword?(email: string): Promise<void>;
  updatePassword?(password: string): Promise<void>;
  updateProfile?(input: { name: string; handle: string }): Promise<void>;
  joinCommunityWithInviteCode?(inviteCode: string): Promise<Community | null>;
  createCommunity?(input: { name: string; description: string; accent: string }): Promise<Community>;
  updateCommunity?(
    communityId: string,
    input: { name: string; description: string; accent: string; coverUrl?: string | null; coverFile?: File }
  ): Promise<Community>;
  regenerateInviteCode?(communityId: string): Promise<string>;
  addNotice?(communityId: string, notice: Omit<Notice, "id" | "createdAt">): Promise<Notice>;
  addEvent?(
    communityId: string,
    event: Omit<CalendarEvent, "id" | "createdAt">
  ): Promise<CalendarEvent>;
  addAlbum?(
    communityId: string,
    album: Omit<Album, "id" | "createdAt" | "items">
  ): Promise<Album>;
  addAlbumItem?(communityId: string, albumId: string, input: AlbumItemInput): Promise<AlbumItem>;
  addDDay?(communityId: string, dday: Omit<DDayItem, "id">): Promise<DDayItem>;
  addPair?(
    communityId: string,
    pair: Omit<RelationshipPair, "id" | "createdAt">
  ): Promise<RelationshipPair>;
  addCircle?(communityId: string, circle: Omit<Circle, "id" | "createdAt">): Promise<Circle>;
  addCommitment?(
    communityId: string,
    commitment: Omit<Commitment, "id" | "createdAt" | "status" | "completedAt">
  ): Promise<Commitment>;
  sendMessage?(communityId: string, body: string): Promise<CommunityMessage>;
  loadCommunityMessages?(communityId: string): Promise<CommunityMessage[]>;
  toggleMessageReaction?(communityId: string, messageId: string, emoji: string): Promise<CommunityMessage>;
  subscribeToCommunityMessages?(
    communityId: string,
    onChange: () => void
  ): () => void;
  addOneSecondLog?(communityId: string, input: { file: File; caption: string }): Promise<OneSecondLog>;
  updateEvent?(
    communityId: string,
    eventId: string,
    event: Omit<CalendarEvent, "id" | "createdAt">
  ): Promise<CalendarEvent>;
  updateAlbum?(
    communityId: string,
    albumId: string,
    album: Omit<Album, "id" | "createdAt" | "items">
  ): Promise<Album>;
  updateAlbumItem?(
    communityId: string,
    albumId: string,
    itemId: string,
    input: AlbumItemUpdateInput
  ): Promise<AlbumItem>;
  updateDDay?(communityId: string, ddayId: string, dday: Omit<DDayItem, "id">): Promise<DDayItem>;
  updateNotice?(
    communityId: string,
    noticeId: string,
    notice: Omit<Notice, "id" | "createdAt">
  ): Promise<Notice>;
  updateMemberRole?(communityId: string, memberId: string, role: Role): Promise<CommunityMember>;
  deleteEvent?(communityId: string, eventId: string): Promise<void>;
  deleteAlbum?(communityId: string, albumId: string): Promise<void>;
  deleteAlbumItem?(communityId: string, albumId: string, itemId: string): Promise<void>;
  deleteDDay?(communityId: string, ddayId: string): Promise<void>;
  deleteNotice?(communityId: string, noticeId: string): Promise<void>;
  deleteOneSecondLog?(communityId: string, logId: string): Promise<void>;
  toggleCommitment?(communityId: string, commitmentId: string): Promise<Commitment>;
  deleteCommitment?(communityId: string, commitmentId: string): Promise<void>;
  deleteCommunity?(communityId: string): Promise<void>;
  removeMember?(communityId: string, memberId: string): Promise<void>;
  createNotification?(
    kind: NotificationKind,
    title: string,
    body: string,
    communityId?: string
  ): Promise<CopulaNotification>;
  notifyCommunityMembers?(
    communityId: string,
    kind: NotificationKind,
    title: string,
    body: string,
    options?: { excludeCurrentUser?: boolean; url?: string; tag?: string }
  ): Promise<void>;
  markNotificationRead?(notificationId: string): Promise<void>;
  markNotificationsRead?(): Promise<void>;
  savePushSubscription?(subscription: PushSubscriptionPayload): Promise<void>;
}
