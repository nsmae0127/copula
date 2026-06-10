import { useState, type CSSProperties, type ReactNode } from "react";
import { CalendarDays, CheckCircle2, ChevronRight, Clock3, ListTodo, Plus, Video, Check } from "lucide-react";
import type { CommunityModule, CopulaState } from "../types";
import { EmptyState } from "../components/ui";
import { triggerHaptic } from "../utils";

interface TodayScreenProps {
  state: CopulaState;
  onOpenCommunityModule: (communityId: string, module: CommunityModule) => void;
  onOpenOneSecondUpload: (communityId: string) => void;
  onToggleCommitment: (communityId: string, commitmentId: string) => Promise<void> | void;
}

export function TodayScreen({
  state,
  onOpenCommunityModule,
  onOpenOneSecondUpload,
  onToggleCommitment
}: TodayScreenProps) {
  const currentUserId = state.currentUser?.id ?? "";
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [celebrations, setCelebrations] = useState<Record<string, string>>({});

  const handleToggleCheck = (communityId: string, commitmentId: string) => {
    triggerHaptic(40);
    const congrats = ["Done! 🎉", "Clear! 🌟", "Good! 👍", "Perfect! 💯"][Math.floor(Math.random() * 4)];
    setCelebrations((prev) => ({ ...prev, [commitmentId]: congrats }));
    setCompletedIds((prev) => [...prev, commitmentId]);

    setTimeout(() => {
      onToggleCommitment(communityId, commitmentId);
      setCelebrations((prev) => {
        const next = { ...prev };
        delete next[commitmentId];
        return next;
      });
    }, 700);
  };

  const schedules = state.communities
    .flatMap((community) =>
      community.events
        .filter((event) => {
          const startsAt = new Date(event.startsAt);
          return startsAt >= today && startsAt < tomorrow;
        })
        .map((event) => ({ community, event }))
    )
    .sort((a, b) => new Date(a.event.startsAt).getTime() - new Date(b.event.startsAt).getTime());

  const commitments = state.communities
    .flatMap((community) => {
      const member = community.members.find((item) => item.userId === currentUserId);
      if (!member) return [];
      return community.commitments
        .filter((item) => item.status === "open" && item.assigneeIds.includes(member.id))
        .map((commitment) => ({ community, commitment }));
    })
    .sort((a, b) => new Date(a.commitment.dueAt).getTime() - new Date(b.commitment.dueAt).getTime())
    .slice(0, 5);

  const missingLogs = state.communities.filter((community) =>
    !(community.oneSecondLogs || []).some(
      (log) => log.userId === currentUserId && isSameDay(new Date(log.createdAt), today)
    )
  );

  const totalActions = schedules.length + commitments.length + missingLogs.length;

  return (
    <div className="today-screen">
      <header className="today-screen-head">
        <div>
          <h1>Today</h1>
        </div>
      </header>

      {state.communities.length > 0 && (
        <TodayBriefingCard 
          schedulesCount={schedules.length}
          commitmentsCount={commitments.length}
          missingLogsCount={missingLogs.length}
        />
      )}

      {!state.communities.length ? (
        <EmptyState
          icon={CalendarDays}
          title="오늘 확인할 Copula가 없습니다"
          body="Copula에 참여하면 일정, 할 일과 1초 기록을 이곳에서 모아볼 수 있습니다."
        />
      ) : (
        <>
          <section className="today-section">
            <div className="today-section-title">
              <Video aria-hidden="true" />
              <h2>오늘의 1초</h2>
              <span>{missingLogs.length ? `${missingLogs.length}개 미기록` : "완료"}</span>
            </div>
            {missingLogs.length ? (
              <div className="today-vlog-grid">
                {missingLogs.map((community) => (
                  <button
                    key={community.id}
                    type="button"
                    className="today-vlog-button"
                    onClick={() => onOpenOneSecondUpload(community.id)}
                    style={{ "--accent": community.accent } as CSSProperties}
                  >
                    <span>{community.name.charAt(0).toUpperCase()}</span>
                    <strong>{community.name}</strong>
                    <Plus aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="today-complete-row">
                <CheckCircle2 aria-hidden="true" />
                <span>모든 Copula에 오늘의 기록을 남겼어요.</span>
              </div>
            )}
          </section>

          <TodayListSection
            icon={CalendarDays}
            title="오늘 일정"
            count={schedules.length}
            empty="오늘 예정된 일정이 없습니다."
          >
            {schedules.map(({ community, event }) => {
              const startsAt = new Date(event.startsAt);
              const now = new Date();
              const isPast = startsAt < now;
              const isNear = Math.abs(startsAt.getTime() - now.getTime()) < 3600000;
              
              return (
                <div className="today-timeline-wrapper" key={`${community.id}-${event.id}`}>
                  <div className={`timeline-line-node ${isPast ? "past" : ""} ${isNear ? "near" : ""}`}>
                    <div className="timeline-node-dot" />
                  </div>
                  <button
                    type="button"
                    className={`today-list-row ${isPast ? "is-past" : ""} ${isNear ? "is-near" : ""}`}
                    onClick={() => onOpenCommunityModule(community.id, "calendar")}
                  >
                    <span className="today-time">{formatTime(event.startsAt)}</span>
                    <span className="today-list-copy">
                      <strong>{event.title}</strong>
                      <small>{community.name}{event.location ? ` · ${event.location}` : ""}</small>
                    </span>
                    <ChevronRight aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </TodayListSection>

          <TodayListSection
            icon={ListTodo}
            title="내 할 일"
            count={commitments.length}
            empty="지금 맡은 할 일이 없습니다."
          >
            {commitments.map(({ community, commitment }) => {
              const isCompleted = completedIds.includes(commitment.id);
              const celebText = celebrations[commitment.id];
              return (
                <div 
                  key={`${community.id}-${commitment.id}`}
                  className={`today-task-row-wrapper ${isCompleted ? "is-completed" : ""}`}
                >
                  {isCompleted && celebText && (
                    <div className="task-celebration-overlay">
                      {celebText}
                    </div>
                  )}
                  <button
                    type="button"
                    className={`today-check-circle ${isCompleted ? "checked" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleCheck(community.id, commitment.id);
                    }}
                    aria-label="할 일 완료 체크"
                  >
                    {isCompleted && <Check size={10} strokeWidth={3} />}
                  </button>
                  <button
                    type="button"
                    className="today-list-row"
                    onClick={() => onOpenCommunityModule(community.id, "commitments")}
                  >
                    <span className="today-task-icon"><Clock3 aria-hidden="true" /></span>
                    <span className="today-list-copy">
                      <strong>{commitment.title}</strong>
                      <small>{community.name} · {formatDue(commitment.dueAt)}</small>
                    </span>
                    <ChevronRight aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </TodayListSection>
        </>
      )}
    </div>
  );
}

function TodayListSection({
  icon: Icon,
  title,
  count,
  empty,
  children
}: {
  icon: typeof CalendarDays;
  title: string;
  count: number;
  empty: string;
  children: ReactNode;
}) {
  return (
    <section className="today-section">
      <div className="today-section-title">
        <Icon aria-hidden="true" />
        <h2>{title}</h2>
        <span>{count}</span>
      </div>
      {count ? <div className="today-list">{children}</div> : <p className="today-empty-copy">{empty}</p>}
    </section>
  );
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}



function formatTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function formatDue(value: string) {
  const due = startOfDay(new Date(value));
  const today = startOfDay(new Date());
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)}일 지남`;
  if (days === 0) return "오늘 마감";
  if (days === 1) return "내일 마감";
  return `${days}일 남음`;
}

// 1. Today Briefing Card Component
function TodayBriefingCard({ 
  schedulesCount, 
  commitmentsCount, 
  missingLogsCount 
}: { 
  schedulesCount: number; 
  commitmentsCount: number; 
  missingLogsCount: number; 
}) {
  const totalRemaining = schedulesCount + commitmentsCount + missingLogsCount;
  
  let emoji = "☀️";
  let title = "상쾌한 하루입니다!";
  let subtitle = "오늘 예정된 모든 일과를 완료했어요. 자유로운 시간을 즐겨보세요!";
  let cardClass = "briefing-clear";

  if (totalRemaining > 0 && totalRemaining <= 2) {
    emoji = "⛅";
    title = "오늘 할 일이 조금 남았네요";
    subtitle = `남은 일과가 ${totalRemaining}개 있습니다. 가볍게 마무리해 볼까요?`;
    cardClass = "briefing-cloudy";
  } else if (totalRemaining > 2) {
    emoji = "☔";
    title = "오늘 챙겨야 할 일이 많아요";
    subtitle = `일정 및 할 일이 총 ${totalRemaining}개 대기 중입니다. 차근차근 해결해 보아요!`;
    cardClass = "briefing-rainy";
  }

  return (
    <div className={`today-briefing-card ${cardClass}`}>
      <div className="briefing-glow" />
      <div className="briefing-emoji">{emoji}</div>
      <div className="briefing-info">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}
