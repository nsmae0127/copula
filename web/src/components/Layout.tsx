import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  Blocks,
  CalendarDays,
  Home,
  Image,
  KeyRound,
  Megaphone,
  MessageCircle,
  MessageCirclePlus,
  Moon,
  Plus,
  Sun,
  UserPlus,
  UserRound,
  Users,
  UsersRound,
  Video,
  type LucideIcon
} from "lucide-react";
import type { Community, CommunityModule, UserProfile, ViewName } from "../types";
import { playTapSound } from "../utils/soundEffects";

interface LayoutProps {
  activeView: ViewName;
  activeModule: CommunityModule;
  currentUser: UserProfile;
  selectedCommunity: Community | null;
  unreadMessageCount: number;
  unreadNotificationCount: number;
  children: ReactNode;
  onViewChange: (view: ViewName) => void;
  onOpenNotifications: () => void;
  onOpenCalendar: () => void;
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
  activeModule,
  currentUser,
  selectedCommunity,
  unreadMessageCount,
  unreadNotificationCount,
  children,
  onViewChange,
  onOpenNotifications,
  onOpenCalendar,
  onOpenJoin,
  onOpenCreateCommunity,
  onOpenQuickNotice,
  onOpenQuickEvent,
  onOpenQuickAlbum,
  onOpenQuickMessage,
  onOpenQuickVlog
}: LayoutProps) {
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
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

  useEffect(() => {
    setIsPlusMenuOpen(false);
    setIsAccountMenuOpen(false);
  }, [activeView, activeModule]);

  useEffect(() => {
    if (!isPlusMenuOpen && !isAccountMenuOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsPlusMenuOpen(false);
        setIsAccountMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isPlusMenuOpen, isAccountMenuOpen]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };
  const plusButton = getPlusButtonConfig(activeView, Boolean(selectedCommunity));
  const PlusButtonIcon = plusButton.icon;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="top-account-area">
          <button
            className={`topbar-account-button ${activeView === "profile" ? "is-active" : ""}`}
            type="button"
            onClick={() => {
              playTapSound();
              setIsPlusMenuOpen(false);
              setIsAccountMenuOpen((current) => !current);
            }}
            aria-label="계정 정보"
            aria-expanded={isAccountMenuOpen}
            aria-controls="topbar-account-menu"
            title="계정 정보"
          >
            <span>{currentUser.initials}</span>
          </button>

          {isAccountMenuOpen ? (
            <>
              <button
                className="account-menu-backdrop"
                type="button"
                aria-label="계정 메뉴 닫기"
                onClick={() => setIsAccountMenuOpen(false)}
              />
              <div className="account-menu-popover" id="topbar-account-menu">
                <div className="account-menu-profile">
                  <span className="account-menu-avatar">{currentUser.initials}</span>
                  <span>
                    <strong>{currentUser.name}</strong>
                    <small>{currentUser.handle}</small>
                  </span>
                </div>
                <div className="account-menu-actions">
                  <button
                    type="button"
                    onClick={() => {
                      playTapSound();
                      setIsAccountMenuOpen(false);
                      onViewChange("profile");
                    }}
                  >
                    <UserRound aria-hidden="true" />
                    <span>계정 설정</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playTapSound();
                      toggleTheme();
                    }}
                  >
                    {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
                    <span>{theme === "dark" ? "라이트 모드" : "다크 모드"}</span>
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
        <div className="brand">
          <div className="brand-mark">
            <img src="/assets/logo-mark-96.png" alt="" aria-hidden="true" />
          </div>
          <div>
            <span className="brand-title">Copula</span>
          </div>
        </div>
        <div className="top-actions">
          <button
            className={`topbar-notification-button ${activeView === "notifications" ? "is-active" : ""}`}
            type="button"
            onClick={() => {
              playTapSound();
              setIsPlusMenuOpen(false);
              setIsAccountMenuOpen(false);
              onOpenNotifications();
            }}
            aria-label={`알림 ${unreadNotificationCount}개`}
            title="알림"
          >
            <Bell aria-hidden="true" />
            {unreadNotificationCount > 0 ? (
              <span className="topbar-notification-badge">
                {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
              </span>
            ) : null}
          </button>
        </div>
      </header>

      <main className="screen">{children}</main>

      <nav className="bottom-nav" aria-label="주요 메뉴">
        {/* 홈 */}
        <button
          className={`nav-item ${activeView === "home" ? "is-active" : ""}`}
          aria-label="홈"
          onClick={() => {
            playTapSound();
            setIsPlusMenuOpen(false);
            onViewChange("home");
          }}
          aria-current={activeView === "home" ? "page" : undefined}
        >
          <span className="nav-icon-wrap"><Home aria-hidden="true" /></span>
          <span className="nav-label">Home</span>
        </button>

        {/* Copula */}
        <button
          className={`nav-item ${activeView === "community" && activeModule !== "calendar" ? "is-active" : ""}`}
          aria-label="Copula"
          onClick={() => {
            playTapSound();
            setIsPlusMenuOpen(false);
            onViewChange("community");
          }}
          aria-current={activeView === "community" && activeModule !== "calendar" ? "page" : undefined}
        >
          <span className="nav-icon-wrap"><Users aria-hidden="true" /></span>
          <span className="nav-label">Copula</span>
        </button>

        {/* + (Plus Button) */}
        <div className="nav-plus-container">
          <button
            className={`nav-item nav-plus-button nav-plus-button-${plusButton.tone} ${isPlusMenuOpen ? "is-active" : ""}`}
            onClick={() => {
              playTapSound();
              setIsPlusMenuOpen(!isPlusMenuOpen);
            }}
            aria-label={plusButton.label}
            aria-expanded={isPlusMenuOpen}
            title={plusButton.label}
          >
            <span className="nav-plus-icon-wrap" aria-hidden="true">
              <PlusButtonIcon className="nav-plus-main-icon" />
              {plusButton.showBadge ? <Plus className="nav-plus-badge-icon" /> : null}
            </span>
          </button>
          
          {isPlusMenuOpen ? (
            <>
              <div className="plus-menu-backdrop" onClick={() => setIsPlusMenuOpen(false)} />
              <div className="plus-menu-popover">
                {activeView === "community" && selectedCommunity ? (
                  <div className="plus-menu-section">
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
                        onOpenQuickAlbum();
                      }}
                    >
                      <Image size={16} />
                      <span>앨범</span>
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
                      <span>오늘 1s</span>
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
                  </div>
                ) : null}
                {activeView === "messages" && selectedCommunity ? (
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
                      <span>메시지 작성</span>
                    </button>
                  </div>
                ) : null}
                {activeView === "home" || activeView === "notifications" || activeView === "profile" || !selectedCommunity ? (
                  <div className="plus-menu-section secondary">
                    <button
                      type="button"
                      onClick={() => {
                        playTapSound();
                        setIsPlusMenuOpen(false);
                        onOpenCreateCommunity();
                      }}
                    >
                      <UsersRound size={16} />
                      <span>새 copula 만들기</span>
                    </button>
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
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        {/* 메시지 */}
        <button
          className={`nav-item ${activeView === "messages" ? "is-active" : ""}`}
          aria-label="메시지"
          onClick={() => {
            playTapSound();
            setIsPlusMenuOpen(false);
            onViewChange("messages");
          }}
          aria-current={activeView === "messages" ? "page" : undefined}
        >
          <span className="nav-icon-wrap">
            <MessageCircle aria-hidden="true" />
            {unreadMessageCount > 0 ? (
              <span className="nav-red-dot" aria-label={`${unreadMessageCount}개 읽지 않은 메시지`} />
            ) : null}
          </span>
          <span className="nav-label nav-label-long">Messages</span>
        </button>

        {/* 캘린더 */}
        <button
          className={`nav-item ${activeView === "community" && activeModule === "calendar" ? "is-active" : ""}`}
          aria-label="캘린더"
          onClick={() => {
            playTapSound();
            setIsPlusMenuOpen(false);
            setIsAccountMenuOpen(false);
            onOpenCalendar();
          }}
          aria-current={activeView === "community" && activeModule === "calendar" ? "page" : undefined}
        >
          <span className="nav-icon-wrap"><CalendarDays aria-hidden="true" /></span>
          <span className="nav-label nav-label-long">Calendar</span>
        </button>
      </nav>
    </div>
  );
}

function getPlusButtonConfig(activeView: ViewName, hasSelectedCommunity: boolean): {
  icon: LucideIcon;
  label: string;
  showBadge: boolean;
  tone: "home" | "content" | "message" | "profile";
} {
  if (activeView === "community" && hasSelectedCommunity) {
    return {
      icon: Blocks,
      label: "콘텐츠 추가",
      showBadge: true,
      tone: "content"
    };
  }

  if (activeView === "messages" && hasSelectedCommunity) {
    return {
      icon: MessageCirclePlus,
      label: "메시지 작성",
      showBadge: false,
      tone: "message"
    };
  }

  if (activeView === "profile") {
    return {
      icon: UserPlus,
      label: "copula 참여/생성",
      showBadge: false,
      tone: "profile"
    };
  }

  return {
    icon: UsersRound,
    label: "새 copula 만들기",
    showBadge: true,
    tone: "home"
  };
}
