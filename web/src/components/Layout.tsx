import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  CalendarDays,
  Home,
  Image,
  KeyRound,
  Megaphone,
  MessageCircle,
  Moon,
  Plus,
  Sun,
  UserRound,
  Users,
  Video,
  type LucideIcon
} from "lucide-react";
import type { Community, ViewName } from "../types";
import { playTapSound } from "../utils/soundEffects";

interface LayoutProps {
  activeView: ViewName;
  selectedCommunity: Community | null;
  unreadNotificationCount: number;
  children: ReactNode;
  onViewChange: (view: ViewName) => void;
  onOpenJoin: () => void;
  onOpenCreateCommunity: () => void;
  onOpenQuickNotice: () => void;
  onOpenQuickEvent: () => void;
  onOpenQuickAlbum: () => void;
  onOpenQuickMessage: () => void;
  onOpenQuickVlog: () => void;
}

export function Layout({
  activeView,
  selectedCommunity,
  unreadNotificationCount,
  children,
  onViewChange,
  onOpenJoin,
  onOpenCreateCommunity,
  onOpenQuickNotice,
  onOpenQuickEvent,
  onOpenQuickAlbum,
  onOpenQuickMessage,
  onOpenQuickVlog
}: LayoutProps) {
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") return saved;
      const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      return systemPrefersDark ? "dark" : "light";
    }
    return "light";
  });

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark-theme");
    } else {
      document.documentElement.classList.remove("dark-theme");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const subtitle = activeView === "community" && selectedCommunity
    ? selectedCommunity.name
    : "";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <img src="/assets/logo-mark-96.png" alt="" aria-hidden="true" />
          </div>
          <div>
            <span className="brand-title">Copula</span>
            <span className="brand-subtitle">{subtitle}</span>
          </div>
        </div>
        <div className="top-actions">
        </div>

      </header>

      <main className="screen">{children}</main>

      <nav className="bottom-nav" aria-label="주요 메뉴">
        {/* 홈 */}
        <button
          className={`nav-item ${activeView === "home" ? "is-active" : ""}`}
          onClick={() => {
            playTapSound();
            setIsPlusMenuOpen(false);
            onViewChange("home");
          }}
          aria-current={activeView === "home" ? "page" : undefined}
        >
          <span className="nav-icon-wrap"><Home aria-hidden="true" /></span>
          <span>홈</span>
        </button>

        {/* Copula */}
        <button
          className={`nav-item ${activeView === "community" ? "is-active" : ""}`}
          onClick={() => {
            playTapSound();
            setIsPlusMenuOpen(false);
            onViewChange("community");
          }}
          aria-current={activeView === "community" ? "page" : undefined}
        >
          <span className="nav-icon-wrap"><Users aria-hidden="true" /></span>
          <span>Copula</span>
        </button>

        {/* + (Plus Button) */}
        <div className="nav-plus-container">
          <button
            className={`nav-item nav-plus-button ${isPlusMenuOpen ? "is-active" : ""}`}
            onClick={() => {
              playTapSound();
              setIsPlusMenuOpen(!isPlusMenuOpen);
            }}
            aria-label="copula 추가 메뉴"
            aria-expanded={isPlusMenuOpen}
          >
            <span className="nav-plus-icon-wrap">
              <Plus aria-hidden="true" />
            </span>
          </button>
          
          {isPlusMenuOpen ? (
            <>
              <div className="plus-menu-backdrop" onClick={() => setIsPlusMenuOpen(false)} />
              <div className="plus-menu-popover">
                {selectedCommunity ? (
                  <div className="plus-menu-section">
                    <button
                      type="button"
                      onClick={() => {
                        playTapSound();
                        setIsPlusMenuOpen(false);
                        onOpenQuickMessage();
                      }}
                    >
                      <MessageCircle size={16} />
                      <span>메시지</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playTapSound();
                        setIsPlusMenuOpen(false);
                        onOpenQuickAlbum();
                      }}
                    >
                      <Image size={16} />
                      <span>사진·메모</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playTapSound();
                        setIsPlusMenuOpen(false);
                        onOpenQuickEvent();
                      }}
                    >
                      <CalendarDays size={16} />
                      <span>일정</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playTapSound();
                        setIsPlusMenuOpen(false);
                        onOpenQuickNotice();
                      }}
                    >
                      <Megaphone size={16} />
                      <span>공지</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playTapSound();
                        setIsPlusMenuOpen(false);
                        onOpenQuickVlog();
                      }}
                    >
                      <Video size={16} />
                      <span>1s Vlog</span>
                    </button>
                  </div>
                ) : null}
                <div className="plus-menu-section secondary">
                <button
                  type="button"
                  onClick={() => {
                    playTapSound();
                    setIsPlusMenuOpen(false);
                    onOpenJoin();
                  }}
                >
                  <KeyRound size={16} />
                  <span>초대 코드로 참여</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    playTapSound();
                    setIsPlusMenuOpen(false);
                    onOpenCreateCommunity();
                  }}
                >
                  <Plus size={16} />
                  <span>새 copula 만들기</span>
                </button>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* 알림 */}
        <button
          className={`nav-item ${activeView === "notifications" ? "is-active" : ""}`}
          onClick={() => {
            playTapSound();
            setIsPlusMenuOpen(false);
            onViewChange("notifications");
          }}
          aria-current={activeView === "notifications" ? "page" : undefined}
        >
          <span className="nav-icon-wrap">
            <Bell aria-hidden="true" />
            {unreadNotificationCount > 0 ? (
              <span className="nav-badge" aria-label={`${unreadNotificationCount}개 읽지 않은 알림`}>
                {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
              </span>
            ) : null}
          </span>
          <span>알림</span>
        </button>

        {/* 계정 */}
        <button
          className={`nav-item ${activeView === "profile" ? "is-active" : ""}`}
          onClick={() => {
            playTapSound();
            setIsPlusMenuOpen(false);
            onViewChange("profile");
          }}
          aria-current={activeView === "profile" ? "page" : undefined}
        >
          <span className="nav-icon-wrap"><UserRound aria-hidden="true" /></span>
          <span>계정</span>
        </button>
      </nav>
    </div>
  );
}
