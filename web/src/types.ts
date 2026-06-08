export type Role = "owner" | "admin" | "member";
export type ViewName = "home" | "community" | "messages" | "notifications" | "profile";
export type CommunityModule =
  | "feed"
  | "messages"
  | "calendar"
  | "commitments"
  | "relationships"
  | "albums"
  | "members"
  | "1s";
export type ModalType =
  | "join"
  | "community"
  | "communityEdit"
  | "notice"
  | "noticeEdit"
  | "event"
  | "eventEdit"
  | "album"
  | "albumEdit"
  | "albumItem"
  | "albumItemEdit"
  | "dday"
  | "ddayEdit"
  | "1sUpload";
export type NotificationKind = "invite" | "calendar" | "album" | "dday" | "notice" | "commitment" | "message" | "1s";
export type AlbumItemKind = "photo" | "note" | "video";
export type CommitmentStatus = "open" | "done";

export interface PushSubscriptionPayload {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
}

export type VisibilityScope =
  | { type: "community" }
  | { type: "circle"; circleId: string }
  | { type: "pair"; pairId: string }
  | { type: "private" };

export interface UserProfile {
  id: string;
  name: string;
  handle: string;
  initials: string;
}

export interface CommunityMember {
  id: string;
  userId: string;
  name: string;
  handle: string;
  initials: string;
  role: Role;
  joinedAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  notes: string;
  location: string;
  startsAt: string;
  createdAt: string;
}

export interface AlbumItem {
  id: string;
  title: string;
  kind: AlbumItemKind;
  mediaUrl?: string;
  ownerName: string;
  createdAt: string;
}

export interface AlbumItemInput {
  title: string;
  kind: AlbumItemKind;
  file?: File;
  mediaUrl?: string;
}

export interface AlbumItemUpdateInput {
  title: string;
  file?: File;
  mediaUrl?: string;
}

export interface Album {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  items: AlbumItem[];
}

export interface DDayItem {
  id: string;
  title: string;
  targetDate: string;
  kind: "기념일" | "여행" | "생일" | "행사";
  note: string;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  pinned: boolean;
}

export interface RelationshipPair {
  id: string;
  memberIds: [string, string];
  label: string;
  createdAt: string;
}

export interface Circle {
  id: string;
  name: string;
  memberIds: string[];
  createdAt: string;
}

export interface Commitment {
  id: string;
  title: string;
  note: string;
  dueAt: string;
  status: CommitmentStatus;
  assigneeIds: string[];
  visibility: VisibilityScope;
  createdAt: string;
  createdByUserId?: string;
  completedAt?: string;
}

export interface OneSecondLog {
  id: string;
  communityId: string;
  userId: string;
  userName: string;
  userInitials: string;
  videoUrl: string;
  caption: string;
  createdAt: string;
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface CommunityMessage {
  id: string;
  communityId: string;
  senderUserId: string;
  senderMemberId: string;
  senderName: string;
  senderInitials: string;
  body: string;
  createdAt: string;
  reactions: MessageReaction[];
}

export interface Community {
  id: string;
  name: string;
  description: string;
  inviteCode: string;
  accent: string;
  coverUrl: string | null;
  createdAt: string;
  contentModules: CommunityModule[];
  members: CommunityMember[];
  events: CalendarEvent[];
  albums: Album[];
  ddays: DDayItem[];
  notices: Notice[];
  pairs: RelationshipPair[];
  circles: Circle[];
  commitments: Commitment[];
  oneSecondLogs: OneSecondLog[];
  messages: CommunityMessage[];
}

export interface CopulaNotification {
  id: string;
  kind: NotificationKind;
  communityId?: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export interface CopulaState {
  currentUser: UserProfile | null;
  selectedCommunityId: string | null;
  communities: Community[];
  notifications: CopulaNotification[];
}

export type JoinResult =
  | { status: "joined"; communityName: string }
  | { status: "alreadyJoined"; communityName: string }
  | { status: "invalidCode" }
  | { status: "needsSignIn" };
