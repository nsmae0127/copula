import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import {
  Bell,
  Blocks,
  CalendarDays,
  CalendarClock,
  CalendarPlus,
  Home,
  Image,
  KeyRound,
  LogOut,
  Megaphone,
  MessageCircle,
  MessageCirclePlus,
  Moon,
  Plus,
  Settings,
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
  onOpenNotificationSettings: () => void;
  onBack: () => void;
  onOpenJoin: () => void;
  onOpenCreateCommunity: () => void;
  onOpenQuickNotice: () => void;
  onOpenQuickEvent: () => void;
  onOpenQuickAlbum: () => void;
  onOpenQuickMessage: () => void;
  onOpenQuickVlog: () => void;
  onSignOut?: () => void;
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
  onOpenNotificationSettings,
  onBack,
  onOpenJoin,
  onOpenCreateCommunity,
  onOpenQuickNotice,
  onOpenQuickEvent,
  onOpenQuickAlbum,
  onOpenQuickMessage,
  onOpenQuickVlog,
  onSignOut
}: LayoutProps) {
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [hideBars, setHideBars] = useState(false);
  const backSwipeStartRef = useRef<{ x: number; y: number; tracking: boolean } | null>(null);
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
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      const saved = localStorage.getItem("theme");
      if (!saved) {
        setTheme(e.matches ? "dark" : "light");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

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

  useEffect(() => {
    if (activeView !== "home") {
      setHideBars(false);
      return;
    }

    let container: Element | null = null;
    let lastScrollY = 0;
    let ticking = false;

    const handleScroll = (e: Event) => {
      const target = e.currentTarget as HTMLElement;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = target.scrollTop;
          
          if (currentScrollY <= 20) {
            setHideBars(false);
          } else {
            const delta = currentScrollY - lastScrollY;
            if (Math.abs(delta) > 10) {
              if (delta > 0) {
                setHideBars(true);
              } else {
                setHideBars(false);
              }
            }
          }
          lastScrollY = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    const setupListener = () => {
      container = document.querySelector(".home-feed-container");
      if (container) {
        lastScrollY = container.scrollTop;
        container.addEventListener("scroll", handleScroll, { passive: true });
      }
    };

    const timer = setTimeout(setupListener, 150);

    return () => {
      clearTimeout(timer);
      if (container) {
        container.removeEventListener("scroll", handleScroll);
      }
    };
  }, [activeView]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };
  const plusButton = getPlusButtonConfig(activeView, Boolean(selectedCommunity));
  const PlusButtonIcon = plusButton.icon;
  const showTopbar = activeView !== "notifications" && activeView !== "messages" && activeView !== "community" && activeView !== "today";

  function handleBackSwipeStart(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse") return;
    const target = event.target as HTMLElement;
    if (
      target.closest(
        ".messages-screen-chat, .notifications-push-modal-overlay, .modal-backdrop, .viewer-backdrop, input, textarea, select, [contenteditable='true']"
      )
    ) {
      return;
    }

    backSwipeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      tracking: event.clientX <= 44
    };
  }

  function handleBackSwipeMove(event: PointerEvent<HTMLDivElement>) {
    const start = backSwipeStartRef.current;
    if (!start?.tracking) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (deltaX > 72 && Math.abs(deltaY) < 54) {
      backSwipeStartRef.current = null;
      setIsPlusMenuOpen(false);
      setIsAccountMenuOpen(false);
      onBack();
    }
  }

  function clearBackSwipeTracking() {
    backSwipeStartRef.current = null;
  }

  return (
    <div
      className={`app-shell ${showTopbar ? "" : "is-headerless"} ${hideBars ? "hide-nav-bars" : ""}`}
      onPointerDown={handleBackSwipeStart}
      onPointerMove={handleBackSwipeMove}
      onPointerUp={clearBackSwipeTracking}
      onPointerCancel={clearBackSwipeTracking}
    >
      {showTopbar ? <header className="topbar">
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
            {currentUser.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt="" />
            ) : (
              <span>{currentUser.initials}</span>
            )}
          </button>

          {isAccountMenuOpen ? (
            <>
              <button
                className="account-menu-backdrop"
                type="button"
                aria-label="계정 메뉴 닫기"
                onPointerDown={() => setIsAccountMenuOpen(false)}
                onClick={() => setIsAccountMenuOpen(false)}
              />
              <div className="account-menu-popover" id="topbar-account-menu">
                <div className="account-menu-profile">
                  {currentUser.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt="" />
                  ) : (
                    <span className="account-menu-avatar">{currentUser.initials}</span>
                  )}
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
                    className="account-menu-toggle-row"
                    onClick={() => {
                      playTapSound();
                      toggleTheme();
                    }}
                  >
                    <span className="account-menu-toggle-label">
                      <Moon aria-hidden="true" />
                      <span>다크 모드</span>
                    </span>
                    <span className={`theme-switch-track ${theme === "dark" ? "is-active" : ""}`}>
                      <span className="theme-switch-thumb" />
                    </span>
                  </button>

                  {onSignOut && (
                    <button
                      type="button"
                      className="account-menu-btn-danger"
                      onClick={() => {
                        playTapSound();
                        setIsAccountMenuOpen(false);
                        onSignOut();
                      }}
                    >
                      <LogOut aria-hidden="true" />
                      <span>로그아웃</span>
                    </button>
                  )}
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
            className="topbar-notification-button"
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
      </header> : null}

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
          className={`nav-item ${activeView === "community" ? "is-active" : ""}`}
          aria-label="Copula"
          onClick={() => {
            playTapSound();
            setIsPlusMenuOpen(false);
            onViewChange("community");
          }}
          aria-current={activeView === "community" ? "page" : undefined}
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
              setIsAccountMenuOpen(false);
              if (activeView === "notifications") {
                setIsPlusMenuOpen(false);
                onOpenNotificationSettings();
                return;
              }
              setIsPlusMenuOpen(!isPlusMenuOpen);
            }}
            aria-label={plusButton.label}
            aria-expanded={activeView === "notifications" ? undefined : isPlusMenuOpen}
            title={plusButton.label}
          >
            <span className="nav-plus-icon-wrap" aria-hidden="true">
              <PlusButtonIcon className="nav-plus-main-icon" />
              {plusButton.showBadge ? <Plus className="nav-plus-badge-icon" /> : null}
            </span>
          </button>
          
          {isPlusMenuOpen && activeView !== "notifications" ? (
            <>
              <div className="plus-menu-backdrop" onClick={() => setIsPlusMenuOpen(false)} />
              <div className="plus-menu-popover">
                {(activeView === "community" || activeView === "today") && selectedCommunity ? (
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
                {activeView === "home" || activeView === "profile" || !selectedCommunity ? (
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

        {/* Chat */}
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
          <span className="nav-label">Chat</span>
        </button>

        {/* Today */}
        <button
          className={`nav-item ${activeView === "today" ? "is-active" : ""}`}
          aria-label="오늘"
          onClick={() => {
            playTapSound();
            setIsPlusMenuOpen(false);
            setIsAccountMenuOpen(false);
            onViewChange("today");
          }}
          aria-current={activeView === "today" ? "page" : undefined}
        >
          <span className="nav-icon-wrap"><CalendarClock aria-hidden="true" /></span>
          <span className="nav-label">Today</span>
        </button>
      </nav>
    </div>
  );
}

function getPlusButtonConfig(activeView: ViewName, hasSelectedCommunity: boolean): {
  icon: LucideIcon;
  label: string;
  showBadge: boolean;
  tone: "home" | "content" | "message" | "profile" | "settings";
} {
  if (activeView === "notifications") {
    return {
      icon: Settings,
      label: "알림 설정",
      showBadge: false,
      tone: "settings"
    };
  }

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

  if (activeView === "today") {
    return {
      icon: CalendarPlus,
      label: "오늘 일정 추가",
      showBadge: false,
      tone: "content"
    };
  }

  return {
    icon: UsersRound,
    label: "새 copula 만들기",
    showBadge: true,
    tone: "home"
  };
}
