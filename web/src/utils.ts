import type { Album, AlbumItem, DDayItem, OneSecondLog, Role, UserProfile } from "./types";

export function createId(prefix: string) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function addDays(days: number, hour = 9) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

export function addHours(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function daysUntil(value: string) {
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - startOfToday().getTime()) / 86_400_000);
}

export function ddayLabel(value: string) {
  const days = daysUntil(value);
  if (days === 0) return "D-Day";
  return days > 0 ? `D-${days}` : `D+${Math.abs(days)}`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short"
  }).format(new Date(value));
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function getLatestAlbumItem(album: Pick<Album, "items">) {
  return album.items.reduce<AlbumItem | null>((latest, item) => {
    if (!latest) return item;
    return new Date(item.createdAt).getTime() > new Date(latest.createdAt).getTime() ? item : latest;
  }, null);
}

export function getAlbumCoverItem(album: Pick<Album, "items">) {
  return album.items.reduce<AlbumItem | null>((cover, item) => {
    if (!item.mediaUrl) return cover;
    if (!cover) return item;
    return new Date(item.createdAt).getTime() > new Date(cover.createdAt).getTime() ? item : cover;
  }, null);
}

export function toInputDate(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function makeInviteCode(name: string) {
  const rawPrefix = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
  const prefix = rawPrefix ? rawPrefix.padEnd(4, "X") : "COPU";
  return `${prefix}${Math.floor(10 + Math.random() * 90)}`;
}

export function roleLabel(role: Role) {
  if (role === "owner") return "소유자";
  if (role === "admin") return "관리자";
  return "멤버";
}

export function ddaySortValue(item: DDayItem) {
  return Math.abs(daysUntil(item.targetDate));
}

export function memberFromUser(user: UserProfile, role: Role, joinedAt = new Date().toISOString()) {
  return {
    id: createId("member"),
    userId: user.id,
    name: user.name,
    handle: user.handle,
    initials: user.initials,
    role,
    joinedAt
  };
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function calculateUserStreak(logs: OneSecondLog[], userId: string): number {
  const userLogs = logs.filter((log) => log.userId === userId);
  if (userLogs.length === 0) return 0;

  const dateKeys = Array.from(
    new Set(
      userLogs.map((log) => {
        const d = new Date(log.createdAt);
        const y = d.getFullYear();
        const m = `${d.getMonth() + 1}`.padStart(2, "0");
        const day = `${d.getDate()}`.padStart(2, "0");
        return `${y}-${m}-${day}`;
      })
    )
  ).sort();

  if (dateKeys.length === 0) return 0;

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const toDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const todayKey = toDateStr(today);
  const yesterdayKey = toDateStr(yesterday);

  const lastKey = dateKeys[dateKeys.length - 1];
  if (lastKey !== todayKey && lastKey !== yesterdayKey) {
    return 0;
  }

  let streak = 1;
  let cursorKey = lastKey;

  for (let i = dateKeys.length - 2; i >= 0; i--) {
    const prevDate = new Date(cursorKey);
    prevDate.setDate(prevDate.getDate() - 1);
    const expectedKey = toDateStr(prevDate);

    if (dateKeys[i] === expectedKey) {
      streak++;
      cursorKey = expectedKey;
    } else {
      break;
    }
  }

  return streak;
}

export function triggerConfetti() {
  if (typeof window === "undefined") return;
  const canvas = document.createElement("canvas");
  canvas.className = "confetti-canvas";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  const handleResize = () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  };
  window.addEventListener("resize", handleResize);

  const colors = ["#F0717A", "#8C74BA", "#F6A8BE", "#FFD6C7", "#6FB7A5", "#E26D5C"];
  const particles: any[] = [];

  // Create explosion particles
  for (let i = 0; i < 150; i++) {
    particles.push({
      x: width / 2,
      y: height / 2 + 50,
      radius: Math.random() * 5 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 16,
      vy: (Math.random() - 0.72) * 24 - 4,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 8,
      opacity: 1
    });
  }

  function updateAndDraw() {
    ctx!.clearRect(0, 0, width, height);
    let active = false;

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.42; // Gravity
      p.vx *= 0.98; // Friction
      p.rotation += p.rotationSpeed;
      p.opacity -= 0.014;

      if (p.opacity > 0) {
        active = true;
        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate((p.rotation * Math.PI) / 180);
        ctx!.globalAlpha = p.opacity;
        ctx!.fillStyle = p.color;
        ctx!.fillRect(-p.radius, -p.radius / 2, p.radius * 2, p.radius);
        ctx!.restore();
      }
    });

    if (active) {
      requestAnimationFrame(updateAndDraw);
    } else {
      window.removeEventListener("resize", handleResize);
      canvas.remove();
    }
  }

  requestAnimationFrame(updateAndDraw);
}

export function triggerHaptic(pattern: number | number[] = 40) {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration errors on unsupported hardware or browsers
    }
  }
}
