

import { useEffect, useMemo, useState } from "react";
import { Bell, Check, Smartphone } from "lucide-react";
import {
  getPushReadiness,
  showPushReadyNotification,
  subscribeToPushNotifications,
  type PushReadiness
} from "../lib/pushNotifications";
import type { CopulaState, NotificationKind, PushSubscriptionPayload } from "../types";
import { EmptyState, NotificationRow, SectionTitle } from "../components/ui";

interface NotificationsScreenProps {
  state: CopulaState;
  settingsRequestKey: number;
  onMarkRead: () => void;
  onOpenNotification: (notification: CopulaState["notifications"][number]) => void;
  onSavePushSubscription: (subscription: PushSubscriptionPayload) => Promise<void> | void;
}

export function NotificationsScreen({
  state,
  settingsRequestKey,
  onMarkRead,
  onOpenNotification,
  onSavePushSubscription
}: NotificationsScreenProps) {
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [pushReadiness, setPushReadiness] = useState<PushReadiness>(() => getPushReadiness());
  const [pushStatus, setPushStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [isPushSaving, setIsPushSaving] = useState(false);
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);

  useEffect(() => {
    if (settingsRequestKey === 0) return;
    setPushStatus(null);
    setIsPushModalOpen(true);
  }, [settingsRequestKey]);

  const filteredNotifications = state.notifications.filter((item) => matchesNotificationFilter(item, filter));

  // 5초 이내 동일 알림 중복 필터링
  const uniqueNotifications = useMemo(() => {
    return filteredNotifications.filter((item, index, self) => {
      return self.findIndex(o => 
        o.title === item.title && 
        o.body === item.body && 
        Math.abs(new Date(o.createdAt).getTime() - new Date(item.createdAt).getTime()) < 5000
      ) === index;
    });
  }, [filteredNotifications]);

  // 날짜별 그룹화
  const groupedNotifications = useMemo(() => {
    const groups: {
      today: typeof uniqueNotifications;
      yesterday: typeof uniqueNotifications;
      earlier: typeof uniqueNotifications;
    } = { today: [], yesterday: [], earlier: [] };

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;

    uniqueNotifications.forEach((item) => {
      const time = new Date(item.createdAt).getTime();
      if (time >= startOfToday) {
        groups.today.push(item);
      } else if (time >= startOfYesterday) {
        groups.yesterday.push(item);
      } else {
        groups.earlier.push(item);
      }
    });

    return groups;
  }, [uniqueNotifications]);

  async function enablePushNotifications() {
    setIsPushSaving(true);
    setPushStatus(null);
    try {
      const subscription = await subscribeToPushNotifications();
      await onSavePushSubscription(subscription);
      await showPushReadyNotification();
      setPushReadiness(getPushReadiness());
      setPushStatus({ tone: "success", message: "푸시 알림을 활성화했습니다." });
    } catch (error) {
      setPushReadiness(getPushReadiness());
      setPushStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "푸시 알림을 설정하지 못했습니다."
      });
    } finally {
      setIsPushSaving(false);
    }
  }

  return (
    <>
      <section className="notifications-header-area">
        <div className="page-head">
          <h1>알림</h1>
        </div>
      </section>

      <section className="section">
        <SectionTitle
          title="최근 알림"
          action={
            <button className="text-button" onClick={onMarkRead} disabled={state.notifications.every((item) => item.read)}>
              <Check aria-hidden="true" />
              모두 읽음
            </button>
          }
        />
        <div className="filter-strip" role="group" aria-label="알림 필터">
          <FilterButton active={filter === "all"} label="전체" onClick={() => setFilter("all")} />
          <FilterButton active={filter === "unread"} label="읽지 않음" onClick={() => setFilter("unread")} />
          <FilterButton active={filter === "commitment"} label="약속" onClick={() => setFilter("commitment")} />
          <FilterButton active={filter === "calendar"} label="일정" onClick={() => setFilter("calendar")} />
          <FilterButton active={filter === "message"} label="메시지" onClick={() => setFilter("message")} />
          <FilterButton active={filter === "community"} label="copula" onClick={() => setFilter("community")} />
        </div>
        
        <div className="notifications-timeline-container">
          {uniqueNotifications.length ? (
            <>
              {groupedNotifications.today.length > 0 && (
                <div className="timeline-group">
                  <h3 className="timeline-group-title">오늘</h3>
                  <div className="list">
                    {groupedNotifications.today.map((item) => (
                      <NotificationRow key={item.id} item={item} onClick={() => onOpenNotification(item)} />
                    ))}
                  </div>
                </div>
              )}
              {groupedNotifications.yesterday.length > 0 && (
                <div className="timeline-group">
                  <h3 className="timeline-group-title">어제</h3>
                  <div className="list">
                    {groupedNotifications.yesterday.map((item) => (
                      <NotificationRow key={item.id} item={item} onClick={() => onOpenNotification(item)} />
                    ))}
                  </div>
                </div>
              )}
              {groupedNotifications.earlier.length > 0 && (
                <div className="timeline-group">
                  <h3 className="timeline-group-title">지난 알림</h3>
                  <div className="list">
                    {groupedNotifications.earlier.map((item) => (
                      <NotificationRow key={item.id} item={item} onClick={() => onOpenNotification(item)} />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <EmptyState icon={Bell} title="표시할 알림이 없습니다" body="조건에 맞는 알림이 생기면 여기에 표시됩니다." />
          )}
        </div>
      </section>

      {/* 푸시 알림 설정 인앱 다이얼로그 팝업 */}
      {isPushModalOpen && (
        <div className="notifications-push-modal-overlay">
          <div className="push-modal-card">
            <div className="push-modal-header">
              <h3>📱 푸시 알림 설정</h3>
              <button className="close-btn" onClick={() => setIsPushModalOpen(false)}>✕</button>
            </div>
            
            <div className="push-modal-body">
              <div className="push-modal-icon-wrap">
                <Smartphone size={36} style={{ color: pushReadiness.status === "granted" ? "var(--teal)" : "var(--muted)" }} />
              </div>
              <h4>{pushReadiness.status === "granted" ? "푸시 알림 수신 중" : "푸시 알림 받기"}</h4>
              <p className="desc">{pushReadiness.message}</p>
              
              {pushStatus ? (
                <p className={`status-banner ${pushStatus.tone === "error" ? "error" : "success"}`} style={{ marginTop: "12px", width: "100%" }}>{pushStatus.message}</p>
              ) : null}
            </div>

            <div className="push-modal-footer">
              <button
                className="primary-button w-full"
                onClick={() => void enablePushNotifications()}
                disabled={
                  isPushSaving ||
                  pushReadiness.status === "unsupported" ||
                  pushReadiness.status === "missingKey" ||
                  pushReadiness.status === "denied"
                }
              >
                {isPushSaving ? "설정 중..." : pushReadiness.status === "granted" ? "다시 연결하기" : "알림 활성화"}
              </button>
              <button className="secondary-button w-full" onClick={() => setIsPushModalOpen(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

type NotificationFilter = "all" | "unread" | "commitment" | "calendar" | "message" | "community";

function FilterButton({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={active ? "is-active" : ""} onClick={onClick} type="button" aria-pressed={active}>
      {label}
    </button>
  );
}

function matchesNotificationFilter(
  item: CopulaState["notifications"][number],
  filter: NotificationFilter
) {
  if (filter === "all") return true;
  if (filter === "unread") return !item.read;
  if (filter === "calendar") return item.kind === "calendar" || item.kind === "dday";
  if (filter === "community") return communityKinds.has(item.kind);
  return item.kind === filter;
}

const communityKinds = new Set<NotificationKind>(["invite", "notice", "album", "message"]);
