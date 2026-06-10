import type { CSSProperties, ReactNode } from "react";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Flag,
  Image,
  KeyRound,
  ListTodo,
  Megaphone,
  MessageCircle,
  Pencil,
  Sparkles,
  Trash2,
  type LucideIcon,
  Users,
  Video
} from "lucide-react";
import type {
  Album,
  AlbumItem,
  CalendarEvent,
  Community,
  CommunityMember,
  CopulaNotification,
  DDayItem,
  NotificationKind
} from "../types";
import { ddayLabel, formatDate, formatDateTime, getAlbumCoverItem, roleLabel, triggerHaptic } from "../utils";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function EmptyState({
  icon: Icon,
  title,
  body
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="empty card">
      <Icon aria-hidden="true" />
      <strong>{title}</strong>
      <span className="small">{body}</span>
    </div>
  );
}

export function SectionTitle({
  title,
  action
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

export function CommunityButton({
  community,
  active,
  onClick,
  currentUserId
}: {
  community: Community;
  active: boolean;
  onClick: () => void;
  currentUserId?: string;
}) {
  const hasCover = Boolean(community.coverUrl);
  const cardStyle = {
    "--accent": community.accent,
    ...(hasCover
      ? { backgroundImage: `linear-gradient(180deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.64)), url(${community.coverUrl})` }
      : {})
  } as CSSProperties;

  const memberCount = community.members.length;
  const eventCount = community.events.length;
  const ddayCount = community.ddays.length;

  const myMember = community.members.find((m) => m.userId === currentUserId);
  const myCommitmentCount = myMember
    ? community.commitments.filter(
        (c) => c.status === "open" && c.assigneeIds.includes(myMember.id)
      ).length
    : 0;

  return (
    <button
      className={`community-button ${active ? "is-active" : ""} ${hasCover ? "has-cover" : "has-gradient"}`}
      onClick={onClick}
      style={cardStyle}
      aria-label={`${community.name} copula 열기`}
    >
      <div className="community-card-overlay" />
      <div className="community-card-stats">
        <span className="stat-item" title="멤버">
          <Users />
          <span>{memberCount}</span>
        </span>
        <span className="stat-item" title="일정">
          <CalendarDays />
          <span>{eventCount}</span>
        </span>
        <span className="stat-item" title="D-Day">
          <Flag />
          <span>{ddayCount}</span>
        </span>
        {currentUserId && myCommitmentCount > 0 ? (
          <span className="stat-item" title="내 약속">
            <ListTodo />
            <span>{myCommitmentCount}</span>
          </span>
        ) : null}
      </div>
      <div className="community-card-content">
        <span className="community-card-title">{community.name}</span>
      </div>
    </button>
  );
}

export function EventRow({
  event,
  community,
  onEdit,
  onDelete
}: {
  event: CalendarEvent;
  community: Community;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const date = new Date(event.startsAt);

  return (
    <article className="card row" style={{ "--accent": community.accent } as CSSProperties}>
      <div className="timeline-date">
        <span>{date.getDate()}</span>
        <small>{date.toLocaleDateString("ko-KR", { month: "short" })}</small>
      </div>
      <div className="row-main">
        <strong>{event.title}</strong>
        <span>
          {formatDateTime(event.startsAt)}
          {event.location ? ` · ${event.location}` : ""}
        </span>
        {event.notes ? <span className="small muted">{event.notes}</span> : null}
      </div>
      {onEdit || onDelete ? (
        <div className="row-actions">
          {onEdit ? (
            <button className="row-icon-button" onClick={onEdit} aria-label="일정 수정" title="일정 수정">
              <Pencil aria-hidden="true" />
            </button>
          ) : null}
          {onDelete ? (
            <button className="row-icon-button danger" onClick={onDelete} aria-label="일정 삭제" title="일정 삭제">
              <Trash2 aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function DDayRow({
  dday,
  community,
  onEdit,
  onDelete
}: {
  dday: DDayItem;
  community: Community;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <article className="card row" style={{ "--accent": community.accent } as CSSProperties}>
      <span className="dday-pill" style={{ background: community.accent }}>
        {ddayLabel(dday.targetDate)}
      </span>
      <div className="row-main">
        <strong>{dday.title}</strong>
        <span>
          {dday.kind} · {formatDate(dday.targetDate)}
        </span>
        {dday.note ? <span className="small muted">{dday.note}</span> : null}
      </div>
      {onEdit || onDelete ? (
        <div className="row-actions">
          {onEdit ? (
            <button className="row-icon-button" onClick={onEdit} aria-label="D-Day 수정" title="D-Day 수정">
              <Pencil aria-hidden="true" />
            </button>
          ) : null}
          {onDelete ? (
            <button className="row-icon-button danger" onClick={onDelete} aria-label="D-Day 삭제" title="D-Day 삭제">
              <Trash2 aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function AlbumCard({
  album,
  community,
  active = false,
  onClick
}: {
  album: Album;
  community: Community;
  active?: boolean;
  onClick: () => void;
}) {
  const coverItem = getAlbumCoverItem(album);

  return (
    <button
      className={`album-button ${active ? "is-active" : ""}`}
      onClick={onClick}
      style={{ "--accent": community.accent } as CSSProperties}
    >
      <div className={`album-thumb ${coverItem ? "has-cover" : ""}`}>
        {coverItem?.mediaUrl ? (
          coverItem.kind === "video" ? (
            <video src={coverItem.mediaUrl} muted playsInline loop autoPlay aria-label={coverItem.title} />
          ) : (
            <img src={coverItem.mediaUrl} alt={coverItem.title} />
          )
        ) : (
          <Image aria-hidden="true" />
        )}
      </div>
      <div className="album-info">
        <strong>{album.title}</strong>
        <span className="small muted">
          {community.name} · {album.items.length}개 사진·메모
        </span>
      </div>
    </button>
  );
}

export function AlbumItemRow({
  item,
  onClick,
  onEdit,
  onDelete
}: {
  item: AlbumItem;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <article className={`card row album-item-row ${item.mediaUrl ? "has-media" : ""}`}>
      <button className="album-item-main" onClick={onClick} type="button">
        {item.mediaUrl ? (
          <div className="album-item-thumb-wrapper">
            <img className="album-item-thumb" src={item.mediaUrl.split(",")[0]} alt="" />
            {item.mediaUrl.includes(",") && (
              <span className="media-badge">+{item.mediaUrl.split(",").length - 1}</span>
            )}
          </div>
        ) : (
          <span className="avatar" style={{ "--accent": "var(--teal)" } as CSSProperties}>
            <Image aria-hidden="true" />
          </span>
        )}
        <div className="row-main">
          <strong>{item.title}</strong>
          <span>
            {item.kind === "photo" ? "사진" : "메모"} · {item.ownerName} · {formatDate(item.createdAt)}
          </span>
        </div>
      </button>
      {onEdit || onDelete ? (
        <div className="row-actions">
          {onEdit ? (
            <button className="row-icon-button" onClick={onEdit} aria-label="사진·메모 수정" title="사진·메모 수정">
              <Pencil aria-hidden="true" />
            </button>
          ) : null}
          {onDelete ? (
            <button className="row-icon-button danger" onClick={onDelete} aria-label="사진·메모 삭제" title="사진·메모 삭제">
              <Trash2 aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function NoticeRow({ community, title, body, pinned, action }: {
  community: Community;
  title: string;
  body: string;
  pinned: boolean;
  action?: ReactNode;
}) {
  return (
    <article className="card row" style={{ "--accent": community.accent } as CSSProperties}>
      <span className="avatar" style={{ "--accent": community.accent } as CSSProperties}>
        <Megaphone aria-hidden="true" />
      </span>
      <div className="row-main">
        <strong>{title}{pinned ? " · 고정" : ""}</strong>
        <span>{body}</span>
      </div>
      {action ? <div className="row-actions">{action}</div> : null}
    </article>
  );
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function MemberRow({
  member,
  community,
  currentUserId,
  onNudge,
  action
}: {
  member: CommunityMember;
  community: Community;
  currentUserId?: string;
  onNudge?: (member: CommunityMember) => void;
  action?: ReactNode;
}) {
  const todayKey = toDateKey(new Date());
  const hasVlog = (community.oneSecondLogs || []).some(
    (log) => log.userId === member.userId && toDateKey(new Date(log.createdAt)) === todayKey
  );

  const avatarContent = (
    <span className="avatar" style={{ "--accent": community.accent } as CSSProperties}>
      {member.initials}
    </span>
  );

  return (
    <article className="card row" style={{ "--accent": community.accent } as CSSProperties}>
      {hasVlog ? (
        <div className="vlog-ring-avatar-wrap" title="오늘 1s 등록 완료">
          {avatarContent}
        </div>
      ) : (
        avatarContent
      )}
      <div className="row-main">
        <strong>{member.name}</strong>
        <span>
          {member.handle} · {roleLabel(member.role)}
        </span>
      </div>
      <div className="row-actions" style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        {onNudge && currentUserId && member.userId !== currentUserId && (
          <button
            className="icon-button compact nudge-btn"
             onClick={() => { triggerHaptic([30, 50]); onNudge(member); }}
            title={`${member.name}님 콕 찌르기`}
            aria-label={`${member.name}님 콕 찌르기`}
            type="button"
          >
            <Sparkles size={14} />
          </button>
        )}
        {action}
      </div>
    </article>
  );
}



export function NotificationRow({ item, onClick }: { item: CopulaNotification; onClick?: () => void }) {
  const Icon = notificationIcon(item.kind);
  const gradient = notificationGradient(item.kind);
  
  // 알림 중 제목과 내용이 동일하거나 겹쳐 보이면 중복 출력 생략
  const cleanBody = item.body.trim();
  const cleanTitle = item.title.trim();
  const isDuplicate = cleanBody === cleanTitle || 
                      (cleanBody.includes(cleanTitle) && cleanBody.length < cleanTitle.length + 5);

  const content = (
    <>
      <span
        className="avatar notification-avatar"
        style={{ background: item.read ? "var(--muted)" : gradient } as CSSProperties}
      >
        <Icon aria-hidden="true" />
      </span>
      <div className="row-main">
        <strong>{item.title}</strong>
        {!isDuplicate && <span>{item.body}</span>}
        <span className="small muted">{formatDateTime(item.createdAt)}</span>
      </div>
      {!item.read && <span className="notification-unread-dot" />}
    </>
  );

  if (onClick) {
    return (
      <button
        className={`card row notification-card notification-button ${item.read ? "is-read" : "is-unread"}`}
        onClick={onClick}
        type="button"
      >
        {content}
      </button>
    );
  }

  return (
    <article className={`card row notification-card ${item.read ? "is-read" : "is-unread"}`}>
      {content}
    </article>
  );
}

function notificationGradient(kind: NotificationKind) {
  const gradients: Record<NotificationKind, string> = {
    invite: "linear-gradient(135deg, #F0717A, #8C74BA)",
    calendar: "linear-gradient(135deg, #6FB7A5, #9CCB9A)",
    album: "linear-gradient(135deg, #F6A8BE, #F0717A)",
    dday: "linear-gradient(135deg, #8C74BA, #F6A8BE)",
    notice: "linear-gradient(135deg, #F0717A, #BFA8E6)",
    commitment: "linear-gradient(135deg, #6FB7A5, #8C74BA)",
    message: "linear-gradient(135deg, #F0717A, #8C74BA)",
    "1s": "linear-gradient(135deg, #8C74BA, #F6A8BE)",
    nudge: "linear-gradient(135deg, #FFD56A, #F0717A)"
  };
  return gradients[kind] ?? "linear-gradient(135deg, #F0717A, #8C74BA)";
}

function notificationIcon(kind: NotificationKind) {
  const icons: Record<NotificationKind, LucideIcon> = {
    invite: KeyRound,
    calendar: CalendarDays,
    album: Image,
    dday: Flag,
    notice: Megaphone,
    commitment: ListTodo,
    message: MessageCircle,
    "1s": Video,
    nudge: Sparkles
  };
  return icons[kind] ?? Bell;
}

export const icons = {
  Bell,
  CalendarDays,
  Check,
  Flag,
  Image,
  KeyRound,
  ListTodo,
  Users
};
