import type { PushSubscriptionPayload } from "../types";

export type PushReadiness =
  | { status: "unsupported"; message: string }
  | { status: "missingKey"; message: string }
  | { status: "denied"; message: string }
  | { status: "granted"; message: string }
  | { status: "default"; message: string };

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export function getPushReadiness(): PushReadiness {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return {
      status: "unsupported",
      message: "이 브라우저에서는 푸시 알림을 사용할 수 없습니다."
    };
  }

  if (!vapidPublicKey) {
    return {
      status: "missingKey",
      message: "푸시 알림 발송 설정을 준비 중입니다."
    };
  }

  if (Notification.permission === "denied") {
    return {
      status: "denied",
      message: "브라우저 설정에서 알림 권한을 허용해 주세요."
    };
  }

  if (Notification.permission === "granted") {
    return {
      status: "granted",
      message: "푸시 알림을 받을 수 있습니다."
    };
  }

  return {
    status: "default",
    message: "약속 마감과 새 공지를 기기 알림으로 받을 수 있습니다."
  };
}

export async function subscribeToPushNotifications(): Promise<PushSubscriptionPayload> {
  const readiness = getPushReadiness();
  if (readiness.status === "unsupported" || readiness.status === "missingKey" || readiness.status === "denied") {
    throw new Error(readiness.message);
  }

  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("알림 권한이 허용되지 않았습니다.");
  }

  const registration = await navigator.serviceWorker.register("/service-worker.js");
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
  });
  const payload = subscription.toJSON() as PushSubscriptionPayload;

  if (!payload.endpoint || !payload.keys?.p256dh || !payload.keys?.auth) {
    throw new Error("푸시 알림 구독 정보를 만들지 못했습니다.");
  }

  return {
    ...payload,
    userAgent: navigator.userAgent
  };
}

export async function showPushReadyNotification() {
  if (!("serviceWorker" in navigator) || Notification.permission !== "granted") return;

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification("Copula 알림이 켜졌습니다.", {
    body: "약속 마감과 새 공지를 기기 알림으로 받을 수 있습니다.",
    icon: "/assets/logo-192.png",
    badge: "/assets/logo-mark-96.png",
    tag: "copula-push-ready",
    data: {
      url: "/"
    }
  });
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }

  return output;
}
