import { CalendarDays, CheckCircle2, ChevronRight, Clock3, ListTodo, Plus, Video } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { CommunityModule, CopulaState } from "../types";
import { EmptyState } from "../components/ui";

interface TodayScreenProps {
  state: CopulaState;
  onOpenCommunityModule: (communityId: string, module: CommunityModule) => void;
  onOpenOneSecondUpload: (communityId: string) => void;
}

export function TodayScreen({
  state,
  onOpenCommunityModule,
  onOpenOneSecondUpload
}: TodayScreenProps) {
  const currentUserId = state.currentUser?.id ?? "";
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

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
          <span>{formatDate(today)}</span>
          <h1>Today</h1>
        </div>
        <span className="today-summary" aria-label={`오늘 확인할 항목 ${totalActions}개`}>
          {totalActions}
        </span>
      </header>

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
            {schedules.map(({ community, event }) => (
              <button
                key={`${community.id}-${event.id}`}
                type="button"
                className="today-list-row"
                onClick={() => onOpenCommunityModule(community.id, "calendar")}
              >
                <span className="today-time">{formatTime(event.startsAt)}</span>
                <span className="today-list-copy">
                  <strong>{event.title}</strong>
                  <small>{community.name}{event.location ? ` · ${event.location}` : ""}</small>
                </span>
                <ChevronRight aria-hidden="true" />
              </button>
            ))}
          </TodayListSection>

          <TodayListSection
            icon={ListTodo}
            title="내 할 일"
            count={commitments.length}
            empty="지금 맡은 할 일이 없습니다."
          >
            {commitments.map(({ community, commitment }) => (
              <button
                key={`${community.id}-${commitment.id}`}
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
            ))}
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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(date);
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
