import { useState, useRef, useEffect, type ReactNode, type CSSProperties } from "react";
import {
  CalendarDays,
  Flag,
  Handshake,
  Image,
  ImageOff,
  KeyRound,
  ListTodo,
  Megaphone,
  MoreHorizontal,
  Plus,
  Flame,
} from "lucide-react";
import type { Community, CommunityModule, CopulaState, VisibilityScope } from "../types";
import { daysUntil, startOfToday, calculateUserStreak, getAlbumCoverItem, getLatestAlbumItem } from "../utils";
import { EmptyState } from "../components/ui";
import { OneSecondPlayerOverlay } from "../components/OneSecondPlayerOverlay";

interface HomeScreenProps {
  state: CopulaState;
  onJoin: () => void;
  onCreateCommunity: () => void;
  onSelectCommunity: (communityId: string) => void;
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
  postedAt: string;
  sortDate: Date;
  data: any;
}

export function HomeScreen({
  state,
  onJoin,
  onCreateCommunity,
  onSelectCommunity,
  onOpenCommunityModule,
  onOpenAlbumCommunity,
  onOpenOneSecondUpload,
  onDeleteOneSecondLog
}: HomeScreenProps) {
  const currentUserId = state.currentUser?.id ?? "";
  const hasCommunities = state.communities.length > 0;
  const todayKey = toDateKey(new Date());

  const [activeStoryCommunity, setActiveStoryCommunity] = useState<Community | null>(null);

  // 몰입 모드 및 다이내믹 무드 조명 상태
  const [focusMode, setFocusMode] = useState(false);
  const [activeAccent, setActiveAccent] = useState("#8c74ba");

  // Pull to Refresh state & refs
  const [pullOffset, setPullOffset] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStart = useRef<{ y: number; x: number } | null>(null);
  const feedContainerRef = useRef<HTMLDivElement | null>(null);
  const pullThreshold = 65;

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isRefreshing) return;
    const container = feedContainerRef.current;
    if (container && container.scrollTop === 0) {
      touchStart.current = {
        y: e.touches[0].clientY,
        x: e.touches[0].clientX
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStart.current || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const deltaY = currentY - touchStart.current.y;
    const deltaX = currentX - touchStart.current.x;

    if (deltaY > 0 && Math.abs(deltaY) > Math.abs(deltaX)) {
      const pull = Math.min(120, deltaY * 0.4);
      setPullOffset(pull);
      if (e.cancelable) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = () => {
    if (!touchStart.current || isRefreshing) return;
    touchStart.current = null;
    
    if (pullOffset >= pullThreshold) {
      setIsRefreshing(true);
      setPullOffset(pullThreshold);
      
      setTimeout(() => {
        setPullOffset(0);
        setIsRefreshing(false);
      }, 1200);
    } else {
      setPullOffset(0);
    }
  };

  // D-Day 위젯 목록 추출
  const ddayItems = hasCommunities ? state.communities.flatMap((community) => {
    return community.ddays
      .filter((dday) => {
        const daysLeft = daysUntil(dday.targetDate);
        return daysLeft >= 0;
      })
      .map((dday) => ({
        id: dday.id,
        title: dday.title,
        targetDate: dday.targetDate,
        community
      }));
  }).sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime()) : [];

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
          postedAt: commitment.createdAt,
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
          postedAt: event.createdAt,
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
        postedAt: community.createdAt,
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
          postedAt: activityDate,
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
          postedAt: notice.createdAt,
          sortDate: new Date(notice.createdAt),
          data: notice
        }));
    })
  ] : [];

  // Home은 모든 Copula의 최신 활동을 시간순으로 모아 보여준다.
  const sortedFeed = allFeedItems.sort(
    (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
  );

  return (
    <div 
      className={`home-screen-container ${focusMode ? "focus-mode-active" : ""}`}
      style={{ "--dynamic-accent-glow": activeAccent } as any}
      onDoubleClick={() => setFocusMode((prev) => !prev)}
      title="화면 빈 곳을 더블 클릭하여 몰입 모드(Focus Mode) 토글"
    >
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
                const isActive = state.selectedCommunityId === community.id;
                
                const communityLogs = community.oneSecondLogs || [];
                const todayLogs = communityLogs.filter(
                  (log) => toDateKey(new Date(log.createdAt)) === todayKey
                );
                const hasTodayVlog = todayLogs.length > 0;
                const hasMyTodayLog = todayLogs.some((log) => log.userId === currentUserId);
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
                  <div className="story-item" key={community.id}>
                    <button
                      className={`story-button ${isActive ? "is-active" : ""} ${hasTodayVlog ? "has-today-vlog" : ""} ${hasMyTodayLog ? "" : "needs-today-log"}`}
                      onClick={handleStoryClick}
                      title={hasTodayVlog ? "오늘 1s 보기" : `${community.name} 이동`}
                    >
                      <div className="story-avatar-wrap">
                        <div className={`story-avatar${community.coverUrl ? " has-image" : " is-empty"}`}>
                          {community.coverUrl ? (
                            <img src={community.coverUrl} alt="" loading="lazy" decoding="async" />
                          ) : (
                            <ImageOff aria-hidden="true" />
                          )}
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
                    {!hasMyTodayLog ? (
                      <button
                        className="story-diary-missing-badge"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenOneSecondUpload?.();
                        }}
                        aria-label={`${community.name} 오늘 1s 기록하기`}
                        title="오늘 1s 기록하기"
                        disabled={!onOpenOneSecondUpload}
                      >
                        <Plus aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          {/* D-Day 위젯 가로 스크롤 카드 */}
          {ddayItems.length > 0 && (
            <section className="home-dday-section">
              <div className="home-dday-list">
                {ddayItems.map((dday) => {
                  const daysLeft = daysUntil(dday.targetDate);
                  const ddayLabel = daysLeft === 0 ? "D-Day" : daysLeft > 0 ? `D-${daysLeft}` : `D+${Math.abs(daysLeft)}`;
                  return (
                    <div 
                      key={dday.id} 
                      className="home-dday-widget-card"
                      style={{ "--accent": dday.community.accent } as CSSProperties}
                      onClick={() => onSelectCommunity(dday.community.id)}
                    >
                      <span className="dday-widget-badge">{ddayLabel}</span>
                      <div className="dday-widget-body">
                        <strong className="dday-widget-title">{dday.title}</strong>
                        <span className="dday-widget-community">{dday.community.name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 인스타 피드 스냅 컨테이너 */}
          <section className="home-feed-section">
            {sortedFeed.length > 0 ? (
              <div 
                className="home-feed-container-wrapper"
                style={{ position: "relative", overflow: "hidden" }}
              >
                {/* Pull-to-Refresh indicator spinner */}
                <div 
                  className={`pull-refresh-indicator ${isRefreshing ? "is-refreshing" : ""}`}
                  style={{
                    transform: `translateY(${pullOffset - 40}px)`,
                    opacity: pullOffset > 0 ? Math.min(1, pullOffset / pullThreshold) : 0,
                    transition: touchStart.current ? "none" : "transform 0.3s ease, opacity 0.3s ease"
                  }}
                >
                  <span className="refresh-spinner-icon" />
                  <span className="refresh-label">
                    {isRefreshing ? "새로고침 중..." : pullOffset >= pullThreshold ? "놓아서 새로고침" : "당겨서 새로고침"}
                  </span>
                </div>

                <div 
                  ref={feedContainerRef}
                  className="home-feed-container"
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  style={{
                    transform: `translateY(${pullOffset}px)`,
                    transition: touchStart.current ? "none" : "transform 0.3s ease"
                  }}
                >
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
  const { community, type, dateLabel, postedAt, title, data } = item;
  const albumCoverItem = type === "album" ? getAlbumCoverItem(data) : null;

  let typeLabel = "";
  let badgeClass = "";
  let icon: ReactNode = null;
  let detailModule: CommunityModule = "feed";
  
  switch (type) {
    case "commitment":
      typeLabel = "약속";
      badgeClass = "badge-commitment";
      icon = <ListTodo size={13} />;
      detailModule = "commitments";
      break;
    case "event":
      typeLabel = "일정";
      badgeClass = "badge-event";
      icon = <CalendarDays size={13} />;
      detailModule = "calendar";
      break;
    case "dday":
      typeLabel = "D-Day";
      badgeClass = "badge-dday";
      icon = <Flag size={13} />;
      detailModule = "calendar";
      break;
    case "album":
      typeLabel = "앨범";
      badgeClass = "badge-album";
      icon = <Image size={13} />;
      detailModule = "albums";
      break;
    case "notice":
      typeLabel = "공지";
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
            {community.coverUrl ? (
              <img src={community.coverUrl} alt="" loading="lazy" decoding="async" />
            ) : (
              <ImageOff aria-hidden="true" />
            )}
          </div>
          <div className="community-meta">
            <span className="community-name-line">
              <span className="community-name">{community.name}</span>
              <span className="feed-card-time">({formatElapsedShort(postedAt)})</span>
            </span>
          </div>
        </div>
        <span className="feed-card-actions">
          <span className={`feed-badge ${badgeClass}`} aria-label={typeLabel} title={typeLabel}>
            {icon}
          </span>
          <button className="feed-more-button" type="button" onClick={handleCardClick} aria-label="자세히 보기">
            <MoreHorizontal aria-hidden="true" />
          </button>
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
              마감: {dateLabel} · 공개 범위: {describeVisibility(community, data.visibility)}
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
                  <video src={albumCoverItem.mediaUrl} muted playsInline loop autoPlay preload="metadata" className="feed-album-media" />
                ) : (
                  <img src={albumCoverItem.mediaUrl} alt={albumCoverItem.title} loading="lazy" decoding="async" className="feed-album-media" />
                )}
              </div>
            ) : (
              <div className="album-placeholder-icon">
                <Image size={36} />
              </div>
            )}
          </div>
        )}

        {type === "notice" && (
          <div className="feed-content-notice">
            <div className="notice-preview-copy">
              <h3>{title}</h3>
              <p>{data.body}</p>
            </div>
          </div>
        )}
      </div>
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

function formatElapsedShort(value: string) {
  const date = new Date(value);
  const diffMs = Math.max(0, Date.now() - date.getTime());
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "now";
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks}w`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo`;
  return `${Math.floor(diffDays / 365)}y`;
}

function unreadMessageCountForCommunity(state: CopulaState, communityId: string) {
  return state.notifications.filter(
    (notification) =>
      notification.kind === "message" &&
      !notification.read &&
      notification.communityId === communityId
  ).length;
}
