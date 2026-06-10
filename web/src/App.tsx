import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Layout } from "./components/Layout";
import { clearStoredAuthReturnError, readStoredAuthReturnError } from "./authReturn";
import { useCopulaStore } from "./state";
import { playTapSound } from "./utils/soundEffects";
import type { Community, CommunityModule, CopulaNotification, ModalType, Role, ViewName } from "./types";

const AlbumItemViewer = lazy(() =>
  import("./components/AlbumItemViewer").then((module) => ({ default: module.AlbumItemViewer }))
);
const ConfirmDialog = lazy(() =>
  import("./components/ConfirmDialog").then((module) => ({ default: module.ConfirmDialog }))
);
const Modal = lazy(() => import("./components/Modal").then((module) => ({ default: module.Modal })));
const AuthScreen = lazy(() => import("./screens/AuthScreen").then((module) => ({ default: module.AuthScreen })));
const CommunityScreen = lazy(() =>
  import("./screens/CommunityScreen").then((module) => ({ default: module.CommunityScreen }))
);
const HomeScreen = lazy(() => import("./screens/HomeScreen").then((module) => ({ default: module.HomeScreen })));
const MessagesScreen = lazy(() =>
  import("./screens/MessagesScreen").then((module) => ({ default: module.MessagesScreen }))
);
const NotificationsScreen = lazy(() =>
  import("./screens/NotificationsScreen").then((module) => ({ default: module.NotificationsScreen }))
);
const ProfileScreen = lazy(() =>
  import("./screens/ProfileScreen").then((module) => ({ default: module.ProfileScreen }))
);
const TodayScreen = lazy(() =>
  import("./screens/TodayScreen").then((module) => ({ default: module.TodayScreen }))
);

const VIEW_KEY = "copula.react.activeView";
const MODULE_KEY = "copula.react.activeModule";
const PENDING_INVITE_KEY = "copula.react.pendingInviteCode";
const AUTH_INTENT_KEY = "copula.react.authIntent";
const INVITE_PARAM = "invite";
const AUTH_TYPE_PARAM = "type";
const ROUTE_VIEW_PARAM = "view";
const ROUTE_COMMUNITY_PARAM = "community";
const ROUTE_MODULE_PARAM = "module";
const validModules = ["feed", "calendar", "commitments", "relationships", "albums", "members", "1s"] as const;
type AuthReturnIntent = "recovery" | null;

interface RouteIntent {
  view: ViewName;
  communityId?: string;
  module?: CommunityModule;
}

interface ModalState {
  type: ModalType;
  albumId?: string;
  inviteCode?: string;
  eventDate?: string;
  eventId?: string;
  noticeId?: string;
  itemId?: string;
  ddayId?: string;
}

interface AlbumItemViewerTarget {
  communityId: string;
  albumId: string;
  itemId: string;
}

interface PendingConfirmation {
  title: string;
  body: string;
  onConfirm: () => Promise<void>;
}

interface ToastState {
  message: string;
  tone: "success" | "error";
}

interface CopulaHistoryState {
  copula: true;
  depth: number;
}

export function App() {
  const { state, selectedCommunity, status, actions } = useCopulaStore();
  const [splashStage, setSplashStage] = useState<"visible" | "animating-out" | "hidden">("visible");

  useEffect(() => {
    const minSplashTime = 1200; // minimum duration (1.2s)
    const startTime = Date.now();
    
    const checkHydration = setInterval(() => {
      if (status.isHydrated) {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, minSplashTime - elapsed);
        
        setTimeout(() => {
          setSplashStage("animating-out");
          clearInterval(checkHydration);
          
          setTimeout(() => {
            setSplashStage("hidden");
          }, 400); // 400ms for CSS fade-out duration
        }, remaining);
      }
    }, 50);
    
    return () => {
      clearInterval(checkHydration);
    };
  }, [status.isHydrated]);

  const [activeView, setActiveView] = useState<ViewName>(
    () => readInitialRouteIntent()?.view ?? (localStorage.getItem(VIEW_KEY) as ViewName | null) ?? "home"
  );
  const [activeModule, setActiveModule] = useState<CommunityModule>(() => {
    const routeModule = readInitialRouteIntent()?.module;
    if (routeModule) return routeModule;
    const saved = localStorage.getItem(MODULE_KEY);
    return isCommunityModule(saved) ? saved : "feed";
  });
  const [selectedMessageCommunityId, setSelectedMessageCommunityId] = useState<string | null>(() => {
    const intent = readInitialRouteIntent();
    return intent?.view === "messages" ? intent.communityId ?? null : null;
  });
  const [isCommunityListOpen, setIsCommunityListOpen] = useState(() => {
    const intent = readInitialRouteIntent();
    return !(intent?.view === "community" && intent.communityId);
  });
  const [notificationSettingsRequestKey, setNotificationSettingsRequestKey] = useState(0);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [viewerTarget, setViewerTarget] = useState<AlbumItemViewerTarget | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [actionError, setActionError] = useState<string | null>(() => readInitialAuthError());
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(() => readInitialInviteCode());
  const [authReturnIntent, setAuthReturnIntent] = useState<AuthReturnIntent>(() => readInitialAuthReturnIntent());
  const toastTimer = useRef<number | null>(null);
  const hasOpenedPendingInvite = useRef(false);
  const hasHandledAuthIntent = useRef(false);
  const hasHandledRouteIntent = useRef(false);
  const previousUserId = useRef<string | null>(state.currentUser?.id ?? null);
  const viewerData = viewerTarget ? resolveAlbumItemViewer(state.communities, viewerTarget) : null;

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, activeView);
  }, [activeView]);

  useEffect(() => {
    localStorage.setItem(MODULE_KEY, activeModule);
  }, [activeModule]);

  useEffect(() => {
    const currentState = window.history.state as CopulaHistoryState | null;
    if (!currentState?.copula) {
      window.history.replaceState(
        { ...(currentState ?? {}), copula: true, depth: 0 },
        "",
        window.location.href
      );
    }

    function handlePopState() {
      const intent = readInitialRouteIntent() ?? { view: "home" as ViewName };
      startViewTransition(() => applyRouteIntent(intent));
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [state.communities]);

  useEffect(() => {
    const urlInviteCode = readInviteCodeFromUrl();
    if (urlInviteCode) {
      removeInviteCodeFromUrl();
    }
  }, []);

  useEffect(() => {
    clearStoredAuthReturnError();
  }, []);

  useEffect(() => {
    if (authReturnIntent) {
      localStorage.setItem(AUTH_INTENT_KEY, authReturnIntent);
    } else {
      localStorage.removeItem(AUTH_INTENT_KEY);
      hasHandledAuthIntent.current = false;
    }
  }, [authReturnIntent]);

  useEffect(() => {
    if (pendingInviteCode) {
      localStorage.setItem(PENDING_INVITE_KEY, pendingInviteCode);
    } else {
      localStorage.removeItem(PENDING_INVITE_KEY);
      hasOpenedPendingInvite.current = false;
    }
  }, [pendingInviteCode]);

  useEffect(() => {
    if (!state.currentUser || !pendingInviteCode || modal || hasOpenedPendingInvite.current) {
      return;
    }

    hasOpenedPendingInvite.current = true;
    setActiveView("home");
    setModal({ type: "join", inviteCode: pendingInviteCode });
  }, [state.currentUser, pendingInviteCode, modal]);

  useEffect(() => {
    if (!state.currentUser || hasHandledRouteIntent.current) {
      return;
    }

    const intent = readInitialRouteIntent();
    if (!intent) {
      hasHandledRouteIntent.current = true;
      return;
    }

    if (intent.view === "community") {
      if (!status.isHydrated) return;
      if (!intent.communityId && !intent.module) {
        hasHandledRouteIntent.current = true;
        setActiveView("community");
        setActiveModule("feed");
        setIsCommunityListOpen(true);
        return;
      }
      const targetCommunity = intent.communityId
        ? state.communities.find((community) => community.id === intent.communityId)
        : selectedCommunity;

      if (targetCommunity) {
        hasHandledRouteIntent.current = true;
        openCommunity(targetCommunity.id, intent.module ?? "feed", undefined, false);
      }
      return;
    }

    if (intent.view === "messages") {
      if (!status.isHydrated) return;
      const targetCommunity = intent.communityId
        ? state.communities.find((community) => community.id === intent.communityId)
        : null;

      hasHandledRouteIntent.current = true;
      openMessages(targetCommunity?.id ?? null, false);
      return;
    }

    hasHandledRouteIntent.current = true;
    setActiveView(intent.view);
    if (intent.module) setActiveModule(intent.module);
  }, [state.currentUser, status.isHydrated, state.communities, selectedCommunity]);

  useEffect(() => {
    const currentUserId = state.currentUser?.id ?? null;
    const wasSignedOut = previousUserId.current === null;
    previousUserId.current = currentUserId;

    if (wasSignedOut && currentUserId && authReturnIntent !== "recovery") {
      resetNavigationToHome();
    }
  }, [state.currentUser?.id, authReturnIntent]);

  useEffect(() => {
    if (!state.currentUser || authReturnIntent !== "recovery" || hasHandledAuthIntent.current) {
      return;
    }

    hasHandledAuthIntent.current = true;
    setActiveView("profile");
    setActiveModule("feed");
    showToast("새 비밀번호를 저장해 주세요.");
  }, [state.currentUser, authReturnIntent]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        window.clearTimeout(toastTimer.current);
      }
    };
  }, []);

  function showToast(message: string, tone: ToastState["tone"] = "success") {
    setToast({ message, tone });
    if (toastTimer.current) {
      window.clearTimeout(toastTimer.current);
    }
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }

  function resetNavigationToHome() {
    localStorage.setItem(VIEW_KEY, "home");
    localStorage.setItem(MODULE_KEY, "feed");
    setActiveView("home");
    setActiveModule("feed");
    setSelectedAlbumId(null);
    setSelectedMessageCommunityId(null);
    setIsCommunityListOpen(true);
    setViewerTarget(null);
  }

  function applyRouteIntent(intent: RouteIntent) {
    if (intent.view === "community") {
      const targetCommunity = intent.communityId
        ? state.communities.find((community) => community.id === intent.communityId)
        : null;
      setActiveView("community");
      setActiveModule(intent.module ?? "feed");
      setSelectedAlbumId(null);
      setSelectedMessageCommunityId(null);
      setIsCommunityListOpen(!targetCommunity);
      if (targetCommunity) actions.selectCommunity(targetCommunity.id);
      return;
    }

    if (intent.view === "messages") {
      const targetCommunity = intent.communityId
        ? state.communities.find((community) => community.id === intent.communityId)
        : null;
      setActiveView("messages");
      setSelectedMessageCommunityId(targetCommunity?.id ?? null);
      setSelectedAlbumId(null);
      if (targetCommunity) actions.selectCommunity(targetCommunity.id);
      return;
    }

    setActiveView(intent.view);
    setActiveModule("feed");
    setSelectedAlbumId(null);
    setSelectedMessageCommunityId(null);
    setIsCommunityListOpen(true);
  }

  function navigateBack() {
    const historyState = window.history.state as CopulaHistoryState | null;
    if (historyState?.copula && historyState.depth > 0) {
      window.history.back();
      return;
    }

    startViewTransition(() => {
      if (activeView === "messages" && selectedMessageCommunityId) {
        replaceRouteIntent({ view: "messages" });
        setSelectedMessageCommunityId(null);
        return;
      }

      if (activeView === "community" && activeModule !== "feed") {
        if (selectedCommunity) {
          replaceRouteIntent({ view: "community", communityId: selectedCommunity.id, module: "feed" });
        }
        setActiveModule("feed");
        setSelectedAlbumId(null);
        return;
      }

      if (activeView === "community" && !isCommunityListOpen) {
        replaceRouteIntent({ view: "community" });
        setIsCommunityListOpen(true);
        return;
      }

      if (activeView !== "home") {
        replaceRouteIntent({ view: "home" });
        resetNavigationToHome();
      }
    });
  }

  if (!state.currentUser) {
    return (
      <>
        <Suspense fallback={<FullScreenFallback />}>
          <AuthScreen
            backend={status.backend}
            error={actionError ?? status.loadError}
            pendingInviteCode={pendingInviteCode}
            isLoading={!status.isHydrated}
            onPasswordReset={actions.resetPassword}
            onLoadOAuthProviders={actions.getAvailableOAuthProviders}
            onOAuthSignIn={async (provider) => {
              setActionError(null);
              await actions.signInWithOAuth(provider);
            }}
            onSignIn={async (credentials) => {
              setActionError(null);
              await actions.signIn(credentials);
              resetNavigationToHome();
            }}
          />
        </Suspense>
        {splashStage !== "hidden" && (
          <div className={`splash-screen ${splashStage === "animating-out" ? "is-fading-out" : ""}`}>
            <div className="splash-content">
              <img src="/assets/logo-mark-256.png" className="splash-logo" alt="Copula Logo" />
              <h1 className="splash-title">Copula</h1>
              <p className="splash-subtitle">소규모 프라이빗 관계형 허브</p>
            </div>
            <div className="splash-footer">
              <span className="splash-brand-footer">Copula</span>
            </div>
          </div>
        )}
      </>
    );
  }

  function openCommunity(
    communityId: string,
    module: CommunityModule = "feed",
    albumId?: string,
    writeHistory = true
  ) {
    if (module === "messages") {
      openMessages(communityId, writeHistory);
      return;
    }
    if (writeHistory) {
      pushRouteIntent({ view: "community", communityId, module });
    }
    actions.selectCommunity(communityId);
    setActiveView("community");
    setIsCommunityListOpen(false);
    setActiveModule(module);
    setSelectedAlbumId(module === "albums" ? albumId ?? null : null);
    setSelectedMessageCommunityId(null);
  }

  function openMessages(communityId?: string | null, writeHistory = true) {
    if (writeHistory) {
      pushRouteIntent({ view: "messages", communityId: communityId ?? undefined });
    }
    if (communityId) {
      actions.selectCommunity(communityId);
      markUnreadMessagesForCommunity(communityId);
    }
    setActiveView("messages");
    setSelectedMessageCommunityId(communityId ?? null);
    setSelectedAlbumId(null);
  }

  function markUnreadMessagesForCommunity(communityId: string) {
    state.notifications
      .filter((item) => item.kind === "message" && !item.read && item.communityId === communityId)
      .forEach((item) => actions.markNotificationRead(item.id));
  }

  function openNotification(item: CopulaNotification) {
    actions.markNotificationRead(item.id);
    if (!item.communityId || !state.communities.some((community) => community.id === item.communityId)) {
      return;
    }

    if (item.kind === "message") {
      openMessages(item.communityId);
      return;
    }

    openCommunity(item.communityId, moduleForNotification(item));
  }

  function openQuickNotice() {
    if (!selectedCommunity) return;
    openCommunity(selectedCommunity.id, "feed");
    setModal({ type: "notice" });
  }

  function openQuickEvent() {
    if (!selectedCommunity) return;
    openCommunity(selectedCommunity.id, "calendar");
    setModal({ type: "event" });
  }

  function openQuickAlbumItem() {
    if (!selectedCommunity) return;
    openCommunity(selectedCommunity.id, "albums", selectedCommunity.albums[0]?.id);
    const albumId = selectedCommunity.albums[0]?.id;
    if (albumId) {
      setModal({ type: "albumItem", albumId });
    } else {
      setModal({ type: "album" });
    }
  }

  function openQuickMessage() {
    openMessages(selectedCommunity?.id ?? null);
  }

  function openQuickVlog() {
    if (!selectedCommunity) return;
    openCommunity(selectedCommunity.id, "1s");
    setModal({ type: "1sUpload" });
  }

  function openJoinModal(inviteCode?: string) {
    setModal({ type: "join", inviteCode });
  }

  function closeModal() {
    if (modal?.type === "join" && modal.inviteCode && modal.inviteCode === pendingInviteCode) {
      setPendingInviteCode(null);
    }
    setModal(null);
  }

  async function copyInviteLink(inviteCode: string, successMessage = "초대 링크를 복사했습니다.") {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard is unavailable.");
      }
      await navigator.clipboard.writeText(createInviteLink(inviteCode));
      showToast(successMessage);
    } catch {
      showToast("초대 링크를 복사하지 못했습니다.", "error");
    }
  }

  async function shareInviteLink(inviteCode: string, communityName?: string) {
    const link = createInviteLink(inviteCode);
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Copula 초대",
          text: communityName ? `${communityName}에 초대합니다.` : "Copula에 초대합니다.",
          url: link
        });
        showToast("초대 링크를 공유했습니다.");
        return;
      }

      await copyInviteLink(inviteCode);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      showToast("초대 링크를 공유하지 못했습니다.", "error");
    }
  }

  function requestDeleteEvent(eventId: string) {
    if (!selectedCommunity) return;
    const event = selectedCommunity.events.find((item) => item.id === eventId);
    setPendingConfirmation({
      title: "일정을 삭제할까요?",
      body: `${event?.title ?? "선택한 일정"}은 삭제 후 다시 복구할 수 없습니다.`,
      onConfirm: async () => {
        await actions.deleteEvent(selectedCommunity.id, eventId);
        showToast("일정을 삭제했습니다.");
        setPendingConfirmation(null);
      }
    });
  }

  function requestDeleteOneSecondLog(logId: string) {
    if (!selectedCommunity) return;
    setPendingConfirmation({
      title: "영상을 삭제할까요?",
      body: "선택한 1초 영상은 삭제 후 다시 복구할 수 없습니다.",
      onConfirm: async () => {
        await actions.deleteOneSecondLog(selectedCommunity.id, logId);
        showToast("영상을 삭제했습니다.");
        setPendingConfirmation(null);
      }
    });
  }

  function openEditEvent(eventId: string) {
    setModal({ type: "eventEdit", eventId });
  }

  function openEditNotice(noticeId: string) {
    setModal({ type: "noticeEdit", noticeId });
  }

  function openEditAlbum(albumId: string) {
    setModal({ type: "albumEdit", albumId });
  }

  function openEditAlbumItem(albumId: string, itemId: string) {
    setModal({ type: "albumItemEdit", albumId, itemId });
  }

  function openEditDDay(ddayId: string) {
    setModal({ type: "ddayEdit", ddayId });
  }

  function requestDeleteAlbumItem(albumId: string, itemId: string) {
    if (!selectedCommunity) return;
    const album = selectedCommunity.albums.find((item) => item.id === albumId);
    const albumItem = album?.items.find((item) => item.id === itemId);
    setPendingConfirmation({
      title: "사진·메모를 삭제할까요?",
      body: `${albumItem?.title ?? "선택한 사진·메모"}는 삭제 후 다시 복구할 수 없습니다.`,
      onConfirm: async () => {
        await actions.deleteAlbumItem(selectedCommunity.id, albumId, itemId);
        showToast("사진·메모를 삭제했습니다.");
        if (viewerTarget?.itemId === itemId) {
          setViewerTarget(null);
        }
        setPendingConfirmation(null);
      }
    });
  }

  function requestDeleteAlbum(albumId: string) {
    if (!selectedCommunity) return;
    const album = selectedCommunity.albums.find((item) => item.id === albumId);
    setPendingConfirmation({
      title: "앨범을 삭제할까요?",
      body: `${album?.title ?? "선택한 앨범"}과 포함된 사진·메모는 삭제 후 다시 복구할 수 없습니다.`,
      onConfirm: async () => {
        await actions.deleteAlbum(selectedCommunity.id, albumId);
        showToast("앨범을 삭제했습니다.");
        if (selectedAlbumId === albumId) {
          setSelectedAlbumId(null);
        }
        if (viewerTarget?.albumId === albumId) {
          setViewerTarget(null);
        }
        setPendingConfirmation(null);
      }
    });
  }

  function requestDeleteDDay(ddayId: string) {
    if (!selectedCommunity) return;
    const dday = selectedCommunity.ddays.find((item) => item.id === ddayId);
    setPendingConfirmation({
      title: "D-Day를 삭제할까요?",
      body: `${dday?.title ?? "선택한 D-Day"}는 삭제 후 다시 복구할 수 없습니다.`,
      onConfirm: async () => {
        await actions.deleteDDay(selectedCommunity.id, ddayId);
        showToast("D-Day를 삭제했습니다.");
        setPendingConfirmation(null);
      }
    });
  }

  function requestDeleteNotice(noticeId: string) {
    if (!selectedCommunity) return;
    const notice = selectedCommunity.notices.find((item) => item.id === noticeId);
    setPendingConfirmation({
      title: "공지를 삭제할까요?",
      body: `${notice?.title ?? "선택한 공지"}는 삭제 후 다시 복구할 수 없습니다.`,
      onConfirm: async () => {
        await actions.deleteNotice(selectedCommunity.id, noticeId);
        showToast("공지를 삭제했습니다.");
        setPendingConfirmation(null);
      }
    });
  }

  function updateMemberRole(memberId: string, role: Role) {
    if (!selectedCommunity) return;
    setActionError(null);
    void actions
      .updateMemberRole(selectedCommunity.id, memberId, role)
      .catch((error) => setActionError(errorMessage(error)));
  }

  function requestRemoveMember(memberId: string) {
    if (!selectedCommunity) return;
    const member = selectedCommunity.members.find((item) => item.id === memberId);
    const isSelf = member?.userId === state.currentUser?.id;
    setPendingConfirmation({
      title: isSelf ? "copula를 나갈까요?" : "멤버를 내보낼까요?",
      body: isSelf
        ? `${selectedCommunity.name}에서 나가면 다시 참여할 때 초대 코드가 필요합니다.`
        : `${member?.name ?? "선택한 멤버"}님은 다시 참여할 때 초대 코드가 필요합니다.`,
      onConfirm: async () => {
        await actions.removeMember(selectedCommunity.id, memberId);
        showToast(isSelf ? "copula에서 나갔습니다." : "멤버를 내보냈습니다.");
        if (isSelf) {
          setActiveView("community");
          setActiveModule("feed");
          setSelectedAlbumId(null);
          setSelectedMessageCommunityId(null);
          setIsCommunityListOpen(true);
          setViewerTarget(null);
        }
        setPendingConfirmation(null);
      }
    });
  }

  function requestRegenerateInviteCode() {
    if (!selectedCommunity) return;
    setPendingConfirmation({
      title: "초대 코드를 재생성할까요?",
      body: "기존 초대 코드는 즉시 만료되고 새 초대 링크만 사용할 수 있습니다.",
      onConfirm: async () => {
        const nextCode = await actions.regenerateInviteCode(selectedCommunity.id);
        await copyInviteLink(nextCode, "새 초대 링크를 만들고 복사했습니다.");
        setPendingConfirmation(null);
      }
    });
  }

  function requestDeleteCommunity() {
    if (!selectedCommunity) return;
    const community = selectedCommunity;
    setModal(null);
    setPendingConfirmation({
      title: "copula를 삭제할까요?",
      body: `${community.name}의 멤버, 일정, 공지, 앨범, D-Day가 모두 삭제됩니다. 이 작업은 다시 되돌릴 수 없습니다.`,
      onConfirm: async () => {
        await actions.deleteCommunity(community.id);
        showToast("copula를 삭제했습니다.");
        setActiveView("community");
        setActiveModule("feed");
        setSelectedAlbumId(null);
        setSelectedMessageCommunityId(null);
        setIsCommunityListOpen(true);
        setViewerTarget(null);
        setPendingConfirmation(null);
      }
    });
  }

  function renderScreen() {
    if (activeView === "community") {
      return (
        <CommunityScreen
          communities={state.communities}
          notifications={state.notifications}
          community={selectedCommunity}
          currentUserId={state.currentUser?.id ?? ""}
          showCommunityList={isCommunityListOpen}
          activeModule={activeModule}
          selectedAlbumId={selectedAlbumId}
          onSelectCommunity={(communityId) => startViewTransition(() => openCommunity(communityId, activeModule))}
          onBackToList={navigateBack}
          onModuleChange={(module) => startViewTransition(() => {
            if (selectedCommunity) {
              pushRouteIntent({ view: "community", communityId: selectedCommunity.id, module });
            }
            setActiveModule(module);
          })}
          onSelectAlbum={setSelectedAlbumId}
          onOpenJoin={() => openJoinModal()}
          onOpenCreateCommunity={() => setModal({ type: "community" })}
          onOpenCommunitySettings={() => setModal({ type: "communityEdit" })}
          onOpenEvent={(eventDate) => setModal({ type: "event", eventDate })}
          onOpenAlbum={() => setModal({ type: "album" })}
          onOpenAlbumItem={(albumId) => setModal({ type: "albumItem", albumId })}
          onOpenAlbumItemDetail={(albumId, itemId) => {
            if (!selectedCommunity) return;
            setViewerTarget({ communityId: selectedCommunity.id, albumId, itemId });
          }}
          onOpenDDay={() => setModal({ type: "dday" })}
          onSetContentModules={actions.setCommunityContentModules}
          onEditEvent={openEditEvent}
          onEditAlbum={openEditAlbum}
          onEditAlbumItem={openEditAlbumItem}
          onEditDDay={openEditDDay}
          onDeleteEvent={requestDeleteEvent}
          onDeleteAlbum={requestDeleteAlbum}
          onDeleteAlbumItem={requestDeleteAlbumItem}
          onDeleteDDay={requestDeleteDDay}
          onUpdateMemberRole={updateMemberRole}
          onRemoveMember={requestRemoveMember}
          onNudgeMember={async (memberId, memberName) => {
            if (!selectedCommunity) return;
            playTapSound();
            actions.notify("nudge", "콕 찌르기 ⚡️", `${state.currentUser?.name}님이 회원님을 콕 찔렀습니다!`, selectedCommunity.id);
            showToast(`${memberName}님을 콕 찔렀습니다!`);
          }}
          canManageRelationships={
            selectedCommunity?.members.some(
              (member) =>
                member.userId === state.currentUser?.id &&
                (member.role === "owner" || member.role === "admin")
            ) ?? false
          }
          onAddPair={async (input) => {
            if (!selectedCommunity) return;
            await actions.addPair(selectedCommunity.id, input);
            showToast("1:1 관계를 만들었습니다.");
          }}
          onAddCircle={async (input) => {
            if (!selectedCommunity) return;
            await actions.addCircle(selectedCommunity.id, input);
            showToast("그룹을 만들었습니다.");
          }}
          onAddCommitment={async (input) => {
            if (!selectedCommunity) return;
            await actions.addCommitment(selectedCommunity.id, input);
            showToast("약속을 등록했습니다.");
          }}
          onToggleCommitment={async (commitmentId) => {
            if (!selectedCommunity) return;
            await actions.toggleCommitment(selectedCommunity.id, commitmentId);
          }}
          onDeleteCommitment={async (commitmentId) => {
            if (!selectedCommunity) return;
            await actions.deleteCommitment(selectedCommunity.id, commitmentId);
            showToast("약속을 삭제했습니다.");
          }}
          onRegenerateInviteCode={requestRegenerateInviteCode}
          onCopyInviteCode={() => {
            if (!selectedCommunity) return;
            void shareInviteLink(selectedCommunity.inviteCode, selectedCommunity.name);
            actions.notify("invite", "초대 링크 공유", `${selectedCommunity.name} 초대 링크를 공유했습니다.`);
          }}
          onOpenOneSecondUpload={() => setModal({ type: "1sUpload" })}
          onDeleteOneSecondLog={requestDeleteOneSecondLog}
          onAddMergedVlogToAlbum={async (communityId, dateKey, videoFile) => {
            const community = state.communities.find(c => c.id === communityId);
            if (!community) return;

            let album = community.albums.find(a => a.title === "데일리 Vlog");
            let albumId = album?.id;
            if (!albumId) {
              albumId = await actions.addAlbum(communityId, {
                title: "데일리 Vlog",
                description: "매일 합쳐진 멤버들의 1초 일상 비디오 모음집"
              });
            }

            const formattedDate = new Intl.DateTimeFormat("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric"
            }).format(new Date(dateKey));

            await actions.addAlbumItem(communityId, albumId, {
              title: `${formattedDate} Vlog`,
              kind: "video",
              files: [videoFile]
            });
          }}
        />
      );
    }

    if (activeView === "messages") {
      return (
        <MessagesScreen
          communities={state.communities}
          currentUserId={state.currentUser?.id ?? ""}
          selectedCommunityId={selectedMessageCommunityId}
          notifications={state.notifications}
          onSelectConversation={(communityId) => {
            pushRouteIntent({ view: "messages", communityId });
            markUnreadMessagesForCommunity(communityId);
            setSelectedMessageCommunityId(communityId);
            actions.selectCommunity(communityId);
          }}
          onBackToList={navigateBack}
          onSendMessage={async (communityId, body) => {
            await actions.sendMessage(communityId, body);
          }}
          onToggleMessageReaction={actions.toggleMessageReaction}
        />
      );
    }

    if (activeView === "notifications") {
      return (
        <NotificationsScreen
          state={state}
          settingsRequestKey={notificationSettingsRequestKey}
          onMarkRead={actions.markNotificationsRead}
          onOpenNotification={openNotification}
          onSavePushSubscription={actions.savePushSubscription}
        />
      );
    }

    if (activeView === "profile") {
      return (
        <ProfileScreen
          state={state}
          backend={status.backend}
          isPasswordResetIntent={authReturnIntent === "recovery"}
          onUpdateProfile={actions.updateProfile}
          onUpdatePassword={async (password) => {
            await actions.updatePassword(password);
            if (authReturnIntent === "recovery") {
              setAuthReturnIntent(null);
            }
          }}
          onResetDemo={() => {
            setActionError(null);
            void actions
              .resetDemo()
              .then(() => {
                startViewTransition(() => {
                  resetNavigationToHome();
                });
              })
              .catch((error) => setActionError(errorMessage(error)));
          }}
          onSignOut={() => {
            setActionError(null);
            void actions
              .signOut()
              .then(() => {
                startViewTransition(() => {
                  resetNavigationToHome();
                });
              })
              .catch((error) => setActionError(errorMessage(error)));
          }}
        />
      );
    }

    if (activeView === "today") {
      return (
        <TodayScreen
          state={state}
          onOpenCommunityModule={(communityId, module) => startViewTransition(() => openCommunity(communityId, module))}
          onOpenOneSecondUpload={(communityId) => {
            actions.selectCommunity(communityId);
            setModal({ type: "1sUpload" });
          }}
        />
      );
    }

    return (
      <HomeScreen
        state={state}
        onJoin={() => openJoinModal()}
        onCreateCommunity={() => setModal({ type: "community" })}
        onSelectCommunity={(communityId) => startViewTransition(() => openCommunity(communityId))}
        onOpenCommunityModule={(communityId, module) => startViewTransition(() => {
          if (module === "messages") {
            openMessages(communityId);
            return;
          }
          openCommunity(communityId, module);
        })}
        onOpenAlbumCommunity={(communityId, albumId) => startViewTransition(() => openCommunity(communityId, "albums", albumId))}
        onOpenOneSecondUpload={() => setModal({ type: "1sUpload" })}
        onDeleteOneSecondLog={requestDeleteOneSecondLog}
      />
    );
  }

  return (
    <>
      <Layout
        activeView={activeView}
        activeModule={activeModule}
        currentUser={state.currentUser}
        selectedCommunity={activeView === "community" && isCommunityListOpen ? null : selectedCommunity}
        unreadMessageCount={state.notifications.filter((item) => item.kind === "message" && !item.read).length}
        unreadNotificationCount={state.notifications.filter((item) => !item.read).length}
        onSignOut={() => {
          setActionError(null);
          void actions
            .signOut()
            .then(() => {
              startViewTransition(() => {
                resetNavigationToHome();
              });
            })
            .catch((error) => setActionError(errorMessage(error)));
        }}
        onViewChange={(view) => startViewTransition(() => {
          pushRouteIntent({ view });
          setActiveView(view);
          if (view === "community") {
            setActiveModule("feed");
            setSelectedAlbumId(null);
            setIsCommunityListOpen(true);
          }
          if (view === "messages") {
            setSelectedMessageCommunityId(null);
          }
        })}
        onOpenNotifications={() => startViewTransition(() => {
          pushRouteIntent({ view: "notifications" });
          setActiveView("notifications");
        })}
        onOpenNotificationSettings={() => setNotificationSettingsRequestKey((current) => current + 1)}
        onBack={navigateBack}
        onOpenJoin={() => openJoinModal()}
        onOpenCreateCommunity={() => setModal({ type: "community" })}
        onOpenQuickNotice={openQuickNotice}
        onOpenQuickEvent={openQuickEvent}
        onOpenQuickAlbum={openQuickAlbumItem}
        onOpenQuickMessage={openQuickMessage}
        onOpenQuickVlog={openQuickVlog}
      >
        {actionError ? <p className="status-banner error">{actionError}</p> : null}
        {status.loadError ? <p className="status-banner error">{status.loadError}</p> : null}
        {status.backend === "supabase" && !status.isHydrated ? (
          <p className="status-banner">동기화 중입니다.</p>
        ) : null}
        <Suspense fallback={<ScreenFallback />}>{renderScreen()}</Suspense>
      </Layout>

      {toast ? (
        <div className={`toast ${toast.tone === "error" ? "is-error" : ""}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      ) : null}

      {modal ? (
        <Suspense fallback={<OverlayFallback />}>
          <Modal
            modal={modal}
            selectedCommunity={selectedCommunity}
            selectedAlbumId={selectedAlbumId}
            canDeleteCommunity={selectedCommunity?.members.some(
              (member) => member.userId === state.currentUser?.id && member.role === "owner"
            ) ?? false}
            onClose={closeModal}
            onJoin={actions.joinCommunity}
            onCreateCommunity={async (name, description, options) => {
              const communityId = await actions.createCommunity(name, description, options);
              if (communityId && options.contentModules.length) {
                await actions.setCommunityContentModules(communityId, options.contentModules);
              }
              if (communityId) {
                pushRouteIntent({ view: "community", communityId, module: "feed" });
              }
              setIsCommunityListOpen(false);
              showToast("copula를 만들었습니다.");
            }}
            onUpdateCommunity={async (communityId, input) => {
              await actions.updateCommunityProfile(communityId, input);
              setActiveView("community");
              showToast("copula 설정을 저장했습니다.");
            }}
            onRequestDeleteCommunity={requestDeleteCommunity}
            onAddNotice={async (communityId, notice) => {
              await actions.addNotice(communityId, notice);
              setActiveView("community");
              setActiveModule("feed");
              showToast("공지를 등록했습니다.");
            }}
            onAddEvent={async (communityId, event) => {
              await actions.addEvent(communityId, event);
              setActiveView("community");
              setActiveModule("calendar");
              showToast("일정을 등록했습니다.");
            }}
            onAddAlbum={async (communityId, album) => {
              const albumId = await actions.addAlbum(communityId, album);
              setActiveView("community");
              setActiveModule("albums");
              showToast("앨범을 만들었습니다.");
              return albumId;
            }}
            onAddAlbumItem={async (communityId, albumId, input) => {
              await actions.addAlbumItem(communityId, albumId, input);
              setSelectedAlbumId(albumId);
              setActiveView("community");
              setActiveModule("albums");
              showToast("사진·메모를 추가했습니다.");
            }}
            onAddOneSecondLog={async (communityId, input) => {
              await actions.addOneSecondLog(communityId, input);
              setActiveView("community");
              setActiveModule("1s");
              showToast("오늘의 1초 영상을 업로드했습니다.");
            }}
            onAddDDay={async (communityId, dday) => {
              await actions.addDDay(communityId, dday);
              setActiveView("community");
              setActiveModule("calendar");
              showToast("D-Day를 추가했습니다.");
            }}
            onUpdateEvent={async (communityId, eventId, event) => {
              await actions.updateEvent(communityId, eventId, event);
              setActiveView("community");
              setActiveModule("calendar");
              showToast("일정을 저장했습니다.");
            }}
            onUpdateAlbum={async (communityId, albumId, album) => {
              await actions.updateAlbum(communityId, albumId, album);
              setSelectedAlbumId(albumId);
              setActiveView("community");
              setActiveModule("albums");
              showToast("앨범을 저장했습니다.");
            }}
            onUpdateAlbumItem={async (communityId, albumId, itemId, input) => {
              await actions.updateAlbumItem(communityId, albumId, itemId, input);
              setSelectedAlbumId(albumId);
              setActiveView("community");
              setActiveModule("albums");
              showToast("사진·메모를 저장했습니다.");
            }}
            onUpdateDDay={async (communityId, ddayId, dday) => {
              await actions.updateDDay(communityId, ddayId, dday);
              setActiveView("community");
              setActiveModule("calendar");
              showToast("D-Day를 저장했습니다.");
            }}
            onUpdateNotice={async (communityId, noticeId, notice) => {
              await actions.updateNotice(communityId, noticeId, notice);
              setActiveView("community");
              setActiveModule("feed");
              showToast("공지를 저장했습니다.");
            }}
            onAlbumCreated={setSelectedAlbumId}
            onJoinedCommunity={(result) => {
              setActiveView("community");
              setActiveModule("feed");
              setIsCommunityListOpen(false);
              if (result?.status === "alreadyJoined") {
                showToast(`${result.communityName}에 이미 참여 중입니다.`);
                setPendingInviteCode(null);
              } else if (result?.status === "joined") {
                showToast(`${result.communityName}에 참여했습니다.`);
                setPendingInviteCode(null);
              }
            }}
          />
        </Suspense>
      ) : null}

      {viewerData ? (
        <Suspense fallback={<OverlayFallback />}>
          <AlbumItemViewer
            item={viewerData.item}
            albumTitle={viewerData.album.title}
            communityName={viewerData.community.name}
            hasPrevious={Boolean(getAdjacentAlbumItemTarget(viewerData.album.items, viewerData.item.id, "previous"))}
            hasNext={Boolean(getAdjacentAlbumItemTarget(viewerData.album.items, viewerData.item.id, "next"))}
            onPrevious={() => {
              const previous = getAdjacentAlbumItemTarget(viewerData.album.items, viewerData.item.id, "previous");
              if (previous) {
                setViewerTarget({ communityId: viewerData.community.id, albumId: viewerData.album.id, itemId: previous.id });
              }
            }}
            onNext={() => {
              const next = getAdjacentAlbumItemTarget(viewerData.album.items, viewerData.item.id, "next");
              if (next) {
                setViewerTarget({ communityId: viewerData.community.id, albumId: viewerData.album.id, itemId: next.id });
              }
            }}
            onClose={() => setViewerTarget(null)}
          />
        </Suspense>
      ) : null}

      {pendingConfirmation ? (
        <Suspense fallback={<OverlayFallback />}>
          <ConfirmDialog
            title={pendingConfirmation.title}
            body={pendingConfirmation.body}
            onCancel={() => setPendingConfirmation(null)}
            onConfirm={pendingConfirmation.onConfirm}
          />
        </Suspense>
      ) : null}

      {splashStage !== "hidden" && (
        <div className={`splash-screen ${splashStage === "animating-out" ? "is-fading-out" : ""}`}>
          <div className="splash-content">
            <img src="/assets/logo-mark-256.png" className="splash-logo" alt="Copula Logo" />
            <h1 className="splash-title">Copula</h1>
            <p className="splash-subtitle">소규모 프라이빗 관계형 허브</p>
          </div>
          <div className="splash-footer">
            <span className="splash-brand-footer">Copula</span>
          </div>
        </div>
      )}
    </>
  );
}

function FullScreenFallback() {
  return (
    <div className="auth-screen">
      <div className="loading-card" role="status" aria-live="polite">
        <span className="loading-spinner" aria-hidden="true" />
        <strong>Copula를 불러오고 있습니다.</strong>
        <span className="small muted">잠시만 기다려 주세요.</span>
      </div>
    </div>
  );
}

function ScreenFallback() {
  return (
    <div className="screen-fallback skeleton-screen" role="status" aria-live="polite">
      <span className="sr-only">화면을 불러오고 있습니다.</span>
      <span className="skeleton-block skeleton-title" aria-hidden="true" />
      <span className="skeleton-block skeleton-banner" aria-hidden="true" />
      <span className="skeleton-block skeleton-row" aria-hidden="true" />
      <span className="skeleton-block skeleton-row is-short" aria-hidden="true" />
    </div>
  );
}

function OverlayFallback() {
  return (
    <div className="modal-backdrop">
      <div className="modal overlay-loader" role="status" aria-live="polite">
        <span className="loading-spinner" aria-hidden="true" />
        <strong>불러오는 중입니다.</strong>
      </div>
    </div>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
}

function readInitialInviteCode() {
  return readInviteCodeFromUrl() ?? normalizeInviteCode(localStorage.getItem(PENDING_INVITE_KEY) ?? "");
}

function readInitialAuthReturnIntent(): AuthReturnIntent {
  return readAuthReturnIntentFromUrl() ?? readStoredAuthReturnIntent();
}

function readInitialAuthError() {
  const storedError = readStoredAuthReturnError();
  if (storedError) return readableAuthReturnError(storedError);

  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const description = searchParams.get("error_description") ?? hashParams.get("error_description");
  if (description) return readableAuthReturnError(description.replace(/\+/g, " "));

  const code = searchParams.get("error_code") ?? hashParams.get("error_code");
  return code ? "로그인을 완료하지 못했습니다. 다시 시도해 주세요." : null;
}

function readableAuthReturnError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("access_denied") || normalized.includes("cancel")) {
    return "로그인이 취소되었습니다.";
  }
  if (normalized.includes("provider is not enabled") || normalized.includes("unsupported provider")) {
    return "아직 사용할 수 없는 간편 로그인입니다.";
  }
  if (normalized.includes("email")) {
    return "계정 이메일 정보를 확인하지 못했습니다.";
  }
  return "로그인을 완료하지 못했습니다. 다시 시도해 주세요.";
}

function readInitialRouteIntent(): RouteIntent | null {
  const searchParams = new URLSearchParams(window.location.search);
  const view = searchParams.get(ROUTE_VIEW_PARAM);
  const module = searchParams.get(ROUTE_MODULE_PARAM);
  const communityId = searchParams.get(ROUTE_COMMUNITY_PARAM) ?? undefined;
  const normalizedView = isViewName(view) ? view : null;

  if (!normalizedView) {
    return null;
  }

  return {
    view: normalizedView,
    communityId,
    module: isCommunityModule(module) ? module : undefined
  };
}

function pushRouteIntent(intent: RouteIntent) {
  const nextLocation = routeUrl(intent);
  const currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextLocation === currentLocation) return;

  const currentState = window.history.state as Partial<CopulaHistoryState> | null;
  window.history.pushState(
    {
      ...(currentState ?? {}),
      copula: true,
      depth: (currentState?.depth ?? 0) + 1
    },
    "",
    nextLocation
  );
}

function replaceRouteIntent(intent: RouteIntent) {
  const url = routeUrl(intent);
  const currentState = window.history.state as Partial<CopulaHistoryState> | null;
  window.history.replaceState(
    {
      ...(currentState ?? {}),
      copula: true,
      depth: currentState?.depth ?? 0
    },
    "",
    url
  );
}

function routeUrl(intent: RouteIntent) {
  const url = new URL(window.location.href);
  url.searchParams.set(ROUTE_VIEW_PARAM, intent.view);
  if (intent.communityId) {
    url.searchParams.set(ROUTE_COMMUNITY_PARAM, intent.communityId);
  } else {
    url.searchParams.delete(ROUTE_COMMUNITY_PARAM);
  }
  if (intent.module && intent.view === "community") {
    url.searchParams.set(ROUTE_MODULE_PARAM, intent.module);
  } else {
    url.searchParams.delete(ROUTE_MODULE_PARAM);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

function isViewName(value: string | null): value is ViewName {
  return value === "home" || value === "community" || value === "today" || value === "messages" || value === "notifications" || value === "profile";
}

function isCommunityModule(value: string | null): value is CommunityModule {
  return validModules.includes(value as (typeof validModules)[number]);
}

function readAuthReturnIntentFromUrl(): AuthReturnIntent {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const type = searchParams.get(AUTH_TYPE_PARAM) ?? hashParams.get(AUTH_TYPE_PARAM);

  return type === "recovery" ? "recovery" : null;
}

function readStoredAuthReturnIntent(): AuthReturnIntent {
  return localStorage.getItem(AUTH_INTENT_KEY) === "recovery" ? "recovery" : null;
}

function readInviteCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return normalizeInviteCode(params.get(INVITE_PARAM) ?? "");
}

function removeInviteCodeFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete(INVITE_PARAM);
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function normalizeInviteCode(value: string) {
  const code = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);
  return code || null;
}

function createInviteLink(inviteCode: string) {
  const url = new URL(window.location.origin);
  url.searchParams.set(INVITE_PARAM, inviteCode);
  return url.toString();
}

function moduleForNotification(item: CopulaNotification): CommunityModule {
  if (item.kind === "message") return "messages";
  if (item.kind === "calendar" || item.kind === "dday") return "calendar";
  if (item.kind === "album") return "albums";
  if (item.kind === "commitment") return "commitments";
  if (item.kind === "1s") return "1s";
  return "feed";
}

function unreadMessageCountForCommunity(notifications: CopulaNotification[], communityId: string) {
  return notifications.filter(
    (item) => item.kind === "message" && !item.read && item.communityId === communityId
  ).length;
}

function resolveAlbumItemViewer(communities: Community[], target: AlbumItemViewerTarget) {
  const community = communities.find((item) => item.id === target.communityId);
  const album = community?.albums.find((item) => item.id === target.albumId);
  const item = album?.items.find((current) => current.id === target.itemId);

  if (!community || !album || !item) {
    return null;
  }

  return { community, album, item };
}

function getAdjacentAlbumItemTarget(
  items: Community["albums"][number]["items"],
  currentItemId: string,
  direction: "previous" | "next"
) {
  const photoItems = items.filter((item) => item.mediaUrl);
  const currentIndex = photoItems.findIndex((item) => item.id === currentItemId);
  if (currentIndex < 0 || photoItems.length < 2) {
    return null;
  }

  const offset = direction === "previous" ? -1 : 1;
  return photoItems[(currentIndex + offset + photoItems.length) % photoItems.length];
}

export function startViewTransition(callback: () => void) {
  if (typeof document !== "undefined" && "startViewTransition" in document) {
    (document as any).startViewTransition(callback);
  } else {
    callback();
  }
}
