import { useState, type ReactNode } from "react";
import {
  Bell,
  CalendarDays,
  Check,
  Clock,
  Flag,
  Handshake,
  Image,
  KeyRound,
  ListTodo,
  Megaphone,
  Plus,
  Flame,
  Sparkles,
  X
} from "lucide-react";
import type { Community, CommunityModule, CopulaNotification, CopulaState, VisibilityScope } from "../types";
import { daysUntil, startOfToday, calculateUserStreak, getAlbumCoverItem, getLatestAlbumItem } from "../utils";
import { EmptyState, NotificationRow } from "../components/ui";
import { OneSecondPlayerOverlay } from "../components/OneSecondPlayerOverlay";

interface HomeScreenProps {
  state: CopulaState;
  onJoin: () => void;
  onCreateCommunity: () => void;
  onSelectCommunity: (communityId: string) => void;
  notifications: CopulaNotification[];
  unreadNotificationCount: number;
  onMarkNotificationsRead: () => void;
  onOpenNotification: (notification: CopulaNotification) => void;
  onOpenCommunityModule: (communityId: string, module: CommunityModule) => void;
  onOpenAlbumCommunity: (communityId: string, albumId?: string) => void;
  onOpenOneSecondUpload?: () => void;
  onDeleteOneSecondLog?: (logId: string) => void;
}

interface FeedItem {
  id: string;
  type: "commitment" | "event" | "dday" | "album" | "notice";
  community: Community;
  title: string;
  dateLabel: string;
  sortDate: Date;
  data: any;
}

export function HomeScreen({
  state,
  onJoin,
  onCreateCommunity,
  onSelectCommunity,
  notifications,
  unreadNotificationCount,
  onMarkNotificationsRead,
  onOpenNotification,
  onOpenCommunityModule,
  onOpenAlbumCommunity,
  onOpenOneSecondUpload,
  onDeleteOneSecondLog
}: HomeScreenProps) {
  const currentUserId = state.currentUser?.id ?? "";
  const hasCommunities = state.communities.length > 0;
  const today = Date.now();
  const todayKey = toDateKey(new Date());

  const [activeStoryCommunity, setActiveStoryCommunity] = useState<Community | null>(null);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const recentNotifications = notifications.slice(0, 20);

  // 몰입 모드 및 다이내믹 무드 조명 상태
  const [focusMode, setFocusMode] = useState(false);
  const [activeAccent, setActiveAccent] = useState("#8c74ba");

  // 1초 일기 오늘자 업로드 여부 판별 (참여 중인 모든 커뮤니티 중 하나라도 올렸는지)
  const hasUploadedToday = state.communities.some((community) =>
    (community.oneSecondLogs || []).some(
      (log) => log.userId === currentUserId && toDateKey(new Date(log.createdAt)) === todayKey
    )
  );

  // 피드 데이터 추출 및 변환
  const allFeedItems: FeedItem[] = hasCommunities ? [
    // 1. 약속 (Commitments)
    ...state.communities.flatMap((community) => {
      const currentMember = community.members.find((member) => member.userId === currentUserId);
      if (!currentMember) return [];
      return community.commitments
        .filter((commitment) => commitment.status === "open" && commitment.assigneeIds.includes(currentMember.id))
        .map((commitment) => ({
          id: `commitment-${commitment.id}`,
          type: "commitment" as const,
          community,
          title: commitment.title,
          dateLabel: formatDue(commitment.dueAt),
          sortDate: new Date(commitment.dueAt),
          data: commitment
        }));
    }),

    // 2. 일정 (Events)
    ...state.communities.flatMap((community) => {
      return community.events
        .filter((event) => new Date(event.startsAt) >= startOfToday())
        .map((event) => ({
          id: `event-${event.id}`,
          type: "event" as const,
          community,
          title: event.title,
          dateLabel: new Date(event.startsAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" }),
          sortDate: new Date(event.startsAt),
          data: event
        }));
    }),

    // 3. D-Day
    ...state.communities.flatMap((community) => {
      return community.ddays.map((dday) => ({
        id: `dday-${dday.id}`,
        type: "dday" as const,
        community,
        title: dday.title,
        dateLabel: formatDue(dday.targetDate),
        sortDate: new Date(dday.targetDate),
        data: dday
      }));
    }),

    // 4. 앨범 (Albums)
    ...state.communities.flatMap((community) => {
      return community.albums.map((album) => {
        const latestItem = getLatestAlbumItem(album);
        const activityDate = latestItem?.createdAt ?? album.createdAt;
        return {
          id: `album-${album.id}`,
          type: "album" as const,
          community,
          title: album.title,
          dateLabel: new Date(activityDate).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }),
          sortDate: new Date(activityDate),
          data: album
        };
      });
    }),

    // 5. 공지
    ...state.communities.flatMap((community) => {
      return [...community.notices]
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 2)
        .map((notice) => ({
          id: `notice-${community.id}-${notice.id}`,
          type: "notice" as const,
          community,
          title: notice.title,
          dateLabel: notice.pinned ? "고정 공지" : formatRelativeDate(notice.createdAt),
          sortDate: new Date(notice.createdAt),
          data: notice
        }));
    })
  ] : [];

  // 오늘과 시간 차이가 가장 적은 순으로 정렬 (절대값 정렬)
  const sortedFeed = allFeedItems.sort((a, b) => {
    const diffA = Math.abs(a.sortDate.getTime() - today);
    const diffB = Math.abs(b.sortDate.getTime() - today);
    return diffA - diffB;
  });

  return (
    <div 
      className={`home-screen-container ${focusMode ? "focus-mode-active" : ""}`}
      style={{ "--dynamic-accent-glow": activeAccent } as any}
      onDoubleClick={() => setFocusMode((prev) => !prev)}
      title="화면 빈 곳을 더블 클릭하여 몰입 모드(Focus Mode) 토글"
    >
      <section className="hero-panel hero-panel-compact">
        <div className="hero-glow-1" />
        <div className="hero-glow-2" />
        <div className="home-hero-row">
          <div className="page-head">
            <h1>반가워요, {state.currentUser?.name ?? "멤버"}님!</h1>
            <p className="muted">
              소중한 관계(copula)들의 소식을 피드에서 한눈에 확인하고 넘겨보세요.
            </p>
          </div>
          <button
            className="home-notification-button"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsNotificationPanelOpen(true);
            }}
            aria-label={`알림 ${unreadNotificationCount}개`}
            title="알림"
          >
            <Bell aria-hidden="true" />
            {unreadNotificationCount > 0 ? (
              <span className="home-notification-badge">
                {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
              </span>
            ) : null}
          </button>
        </div>
      </section>

      {isNotificationPanelOpen ? (
        <>
          <div className="home-notification-backdrop" onClick={() => setIsNotificationPanelOpen(false)} />
          <section className="home-notification-sheet" role="dialog" aria-modal="true" aria-label="알림 내역">
            <div className="home-notification-head">
              <div>
                <h2>알림</h2>
                <span>{unreadNotificationCount > 0 ? `읽지 않음 ${unreadNotificationCount}개` : "모두 확인했습니다"}</span>
              </div>
              <div className="home-notification-actions">
                <button
                  className="icon-button compact"
                  type="button"
                  onClick={onMarkNotificationsRead}
                  disabled={notifications.every((item) => item.read)}
                  aria-label="모두 읽음"
                  title="모두 읽음"
                >
                  <Check aria-hidden="true" />
                </button>
                <button
                  className="icon-button compact"
                  type="button"
                  onClick={() => setIsNotificationPanelOpen(false)}
                  aria-label="알림 닫기"
                  title="닫기"
                >
                  <X aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="home-notification-list">
              {recentNotifications.length ? (
                recentNotifications.map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    onClick={() => {
                      onOpenNotification(item);
                      setIsNotificationPanelOpen(false);
                    }}
                  />
                ))
              ) : (
                <EmptyState icon={Bell} title="알림이 없습니다" body="새로운 소식이 생기면 이곳에 표시됩니다." />
              )}
            </div>
          </section>
        </>
      ) : null}

      {!hasCommunities ? (
        <section className="onboarding-panel card">
          <div>
            <span className="eyebrow">시작하기</span>
            <h2>초대 코드로 참여하거나 copula를 만들어 시작하세요.</h2>
            <p className="muted">캘린더, 공지, 앨범, 관계 약속을 한 공간에서 관리할 수 있습니다.</p>
          </div>
          <div className="onboarding-steps" aria-label="시작 순서">
            <span><strong>1</strong> 초대 코드 입력</span>
            <span><strong>2</strong> copula 참여</span>
            <span><strong>3</strong> 일정과 약속 관리</span>
          </div>
          <div className="button-pair">
            <button className="primary-button" onClick={onJoin}>
              <KeyRound aria-hidden="true" />
              초대 코드 입력
            </button>
            <button className="secondary-button" onClick={onCreateCommunity}>
              <Plus aria-hidden="true" />
              copula 만들기
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* 가로형 My Copula 스토리 바 */}
          <section className="home-stories-section">
            <div className="stories-scroll-container">
              {state.communities.map((community) => {
                const initial = community.name.charAt(0).toUpperCase();
                const isActive = state.selectedCommunityId === community.id;
                
                const communityLogs = community.oneSecondLogs || [];
                const todayLogs = communityLogs.filter(
                  (log) => toDateKey(new Date(log.createdAt)) === todayKey
                );
                const hasTodayVlog = todayLogs.length > 0;
                const userStreak = calculateUserStreak(communityLogs, currentUserId);
                const unreadMessages = unreadMessageCountForCommunity(state, community.id);

                const handleStoryClick = () => {
                  if (hasTodayVlog) {
                    setActiveStoryCommunity(community);
                  } else {
                    onSelectCommunity(community.id);
                  }
                };

                return (
                  <button
                    key={community.id}
                    className={`story-button ${isActive ? "is-active" : ""} ${hasTodayVlog ? "has-today-vlog" : ""}`}
                    onClick={handleStoryClick}
                    title={hasTodayVlog ? "오늘의 1s Vlog 바로보기" : `${community.name} 이동`}
                  >
                    <div className="story-avatar-wrap">
                      <div className="story-avatar">
                        {initial}
                      </div>
                      {userStreak > 0 && (
                        <div className="story-streak-badge" title={`연속 ${userStreak}일 작성`}>
                          <Flame size={10} fill="currentColor" />
                          <span>{userStreak}</span>
                        </div>
                      )}
                      {unreadMessages > 0 ? (
                        <div className="story-message-badge" title={`읽지 않은 메시지 ${unreadMessages}개`}>
                          {unreadMessages > 9 ? "9+" : unreadMessages}
                        </div>
                      ) : null}
                    </div>
                    <span className="story-name">{community.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 1s Vlog 스마트 리마인더 인앱 배너 */}
          {!hasUploadedToday && onOpenOneSecondUpload && (
            <div className="home-reminder-banner fade-in" onClick={onOpenOneSecondUpload}>
              <div className="reminder-left">
                <div className="reminder-icon-circle">
                  <Sparkles size={16} />
                </div>
                <div className="reminder-text">
                  <strong>오늘의 1초 일기가 아직 없습니다!</strong>
                  <span>🔥 소중한 오늘의 순간을 기록하고 스트릭을 이어가세요.</span>
                </div>
              </div>
              <button className="reminder-action-btn">
                기록하기
              </button>
            </div>
          )}

          {/* 인스타 피드 스냅 컨테이너 */}
          <section className="home-feed-section">
            {sortedFeed.length > 0 ? (
              <div className="home-feed-container">
                {sortedFeed.map((item) => (
                  <div 
                    key={item.id} 
                    className="home-feed-card-snap-wrapper"
                    onMouseEnter={() => setActiveAccent(item.community.accent)}
                    onTouchStart={() => setActiveAccent(item.community.accent)}
                  >
                    {renderFeedCard(item, onOpenCommunityModule, onOpenAlbumCommunity)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="home-feed-empty">
                <EmptyState
                  icon={CalendarDays}
                  title="새로운 소식이 없습니다"
                  body="참여 중인 copula에 일정, 약속, 또는 앨범을 추가하여 피드를 채워보세요!"
                />
              </div>
            )}
          </section>
        </>
      )}

      {/* 1s Vlog 스토리 뷰어 모달 */}
      {activeStoryCommunity && (
        <OneSecondPlayerOverlay
          logs={activeStoryCommunity.oneSecondLogs.filter(
            (log) => toDateKey(new Date(log.createdAt)) === todayKey
          )}
          dateKey={todayKey}
          dateLabel={`${activeStoryCommunity.name}의 오늘`}
          currentUserId={currentUserId}
          onClose={() => setActiveStoryCommunity(null)}
          onDeleteLog={onDeleteOneSecondLog}
        />
      )}

    </div>
  );
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function renderFeedCard(
  item: FeedItem,
  onOpenCommunityModule: (communityId: string, module: CommunityModule) => void,
  onOpenAlbumCommunity: (communityId: string, albumId?: string) => void
) {
  const { community, type, dateLabel, title, data } = item;
  const initial = community.name.charAt(0).toUpperCase();
  const albumCoverItem = type === "album" ? getAlbumCoverItem(data) : null;
  const albumItemCount = type === "album" && Array.isArray(data.items) ? data.items.length : 0;

  let badgeText = "";
  let badgeClass = "";
  let icon: ReactNode = null;
  let detailModule: CommunityModule = "feed";
  
  switch (type) {
    case "commitment":
      badgeText = "약속";
      badgeClass = "badge-commitment";
      icon = <ListTodo size={13} />;
      detailModule = "commitments";
      break;
    case "event":
      badgeText = "일정";
      badgeClass = "badge-event";
      icon = <CalendarDays size={13} />;
      detailModule = "calendar";
      break;
    case "dday":
      badgeText = "D-Day";
      badgeClass = "badge-dday";
      icon = <Flag size={13} />;
      detailModule = "calendar";
      break;
    case "album":
      badgeText = "앨범";
      badgeClass = "badge-album";
      icon = <Image size={13} />;
      detailModule = "albums";
      break;
    case "notice":
      badgeText = "공지";
      badgeClass = "badge-notice";
      icon = <Megaphone size={13} />;
      detailModule = "feed";
      break;
  }

  const handleCardClick = () => {
    if (type === "album") {
      onOpenAlbumCommunity(community.id, data.id);
    } else {
      onOpenCommunityModule(community.id, detailModule);
    }
  };

  return (
    <article className="feed-card">
      <header className="feed-card-header">
        <div className="feed-card-community">
          <div className="community-avatar-mini">
            {initial}
          </div>
          <div className="community-meta">
            <span className="community-name">{community.name}</span>
            <span className="feed-card-date">{dateLabel}</span>
          </div>
        </div>
        <span className={`feed-badge ${badgeClass}`}>
          {icon}
          {badgeText}
        </span>
      </header>

      <div className="feed-card-body" onClick={handleCardClick}>
        {type === "commitment" && (
          <div className="feed-content-commitment">
            <div className="commitment-card-icon-wrap">
              <Handshake size={28} />
            </div>
            <h3>{title}</h3>
            <span className="commitment-scope">
              공개 범위: {describeVisibility(community, data.visibility)}
            </span>
            {data.description && <p className="commitment-desc">{data.description}</p>}
          </div>
        )}

        {type === "event" && (
          <div className="feed-content-event">
            <div className="event-date-block">
              <span className="event-month">{new Date(data.startsAt).getMonth() + 1}월</span>
              <span className="event-day">{new Date(data.startsAt).getDate()}일</span>
            </div>
            <div className="event-details">
              <h3>{title}</h3>
              {data.location && (
                <span className="event-location">📍 {data.location}</span>
              )}
              {data.description && <p className="event-desc">{data.description}</p>}
            </div>
          </div>
        )}

        {type === "dday" && (
          <div className="feed-content-dday">
            <div className="dday-main-display">
              <span className="dday-count">{formatDue(data.targetDate)}</span>
            </div>
            <h3>{title}</h3>
            <span className="dday-date">목표일: {new Date(data.targetDate).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}</span>
          </div>
        )}

        {type === "album" && (
          <div className="feed-content-album">
            {albumCoverItem?.mediaUrl ? (
              <div className="album-media-container">
                {albumCoverItem.kind === "video" ? (
                  <video src={albumCoverItem.mediaUrl} muted playsInline loop autoPlay className="feed-album-media" />
                ) : (
                  <img src={albumCoverItem.mediaUrl} alt={albumCoverItem.title} className="feed-album-media" />
                )}
              </div>
            ) : (
              <div className="album-placeholder-icon">
                <Image size={36} />
              </div>
            )}
            <div className="album-meta-text">
              <h3>{title}</h3>
              {albumCoverItem ? (
                <p className="album-memo">{albumCoverItem.title} · {albumItemCount}개 사진·메모</p>
              ) : data.description ? (
                <p className="album-memo">{data.description}</p>
              ) : null}
            </div>
          </div>
        )}

        {type === "notice" && (
          <div className="feed-content-notice">
            <div className="notice-preview-icon">
              <Megaphone size={26} />
            </div>
            <div className="notice-preview-copy">
              <h3>{title}</h3>
              <p>{data.body}</p>
            </div>
          </div>
        )}
      </div>

      <footer className="feed-card-footer">
        <button className="feed-action-btn" onClick={handleCardClick}>
          자세히 보기
          <Clock size={13} />
        </button>
      </footer>
    </article>
  );
}

function describeVisibility(community: Community, visibility?: VisibilityScope) {
  if (!visibility) {
    return "전체";
  }
  if (visibility.type === "pair") {
    return (community.pairs || []).find((pair) => pair.id === visibility.pairId)?.label ?? "1:1";
  }
  if (visibility.type === "circle") {
    return (community.circles || []).find((circle) => circle.id === visibility.circleId)?.name ?? "그룹";
  }
  if (visibility.type === "private") {
    return "나만";
  }
  return "전체";
}

function formatDue(value: string) {
  const days = daysUntil(value);
  if (days < 0) return `D+${Math.abs(days)}`;
  if (days === 0) return "오늘";
  if (days === 1) return "내일";
  return `D-${days}`;
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "방금 전";
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function unreadMessageCountForCommunity(state: CopulaState, communityId: string) {
  return state.notifications.filter(
    (notification) =>
      notification.kind === "message" &&
      !notification.read &&
      notification.communityId === communityId
  ).length;
}
