import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type PointerEvent } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock,
  Flag,
  Handshake,
  Image,
  ListTodo,
  type LucideIcon,
  Megaphone,
  Network,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Share2,
  Trash2,
  UserMinus,
  UserRound,
  Users,
  Video,
  Wallet
} from "lucide-react";
import { getKoreanHoliday } from "../holidays";
import type { Album, CalendarEvent, Community, CommunityModule, Role, VisibilityScope, OneSecondLog } from "../types";
import { OneSecondPlayerOverlay } from "../components/OneSecondPlayerOverlay";
import { ddayLabel, ddaySortValue, formatDateTime, getAlbumCoverItem, getLatestAlbumItem, roleLabel, triggerConfetti } from "../utils";
import { playChimeSound } from "../utils/soundEffects";
import {
  AlbumCard,
  AlbumItemRow,
  DDayRow,
  EmptyState,
  EventRow,
  MemberRow,
  SectionTitle
} from "../components/ui";
import { OneSecondModule } from "./OneSecondModule";

interface CommunityScreenProps {
  communities: Community[];
  community: Community | null;
  currentUserId: string;
  activeModule: CommunityModule;
  selectedAlbumId: string | null;
  onSelectCommunity: (communityId: string) => void;
  onModuleChange: (module: CommunityModule) => void;
  onSelectAlbum: (albumId: string) => void;
  onOpenJoin: () => void;
  onOpenCreateCommunity: () => void;
  onOpenCommunitySettings: () => void;
  onOpenNotice: () => void;
  onOpenEvent: (dateKey?: string) => void;
  onOpenAlbum: () => void;
  onOpenAlbumItem: (albumId: string) => void;
  onOpenAlbumItemDetail: (albumId: string, itemId: string) => void;
  onOpenDDay: () => void;
  onEditNotice: (noticeId: string) => void;
  onEditEvent: (eventId: string) => void;
  onEditAlbum: (albumId: string) => void;
  onEditAlbumItem: (albumId: string, itemId: string) => void;
  onEditDDay: (ddayId: string) => void;
  onDeleteEvent: (eventId: string) => void;
  onDeleteAlbum: (albumId: string) => void;
  onDeleteAlbumItem: (albumId: string, itemId: string) => void;
  onDeleteDDay: (ddayId: string) => void;
  onDeleteNotice: (noticeId: string) => void;
  onUpdateMemberRole: (memberId: string, role: Role) => void;
  onRemoveMember: (memberId: string) => void;
  canManageRelationships: boolean;
  onAddPair: (input: { memberIds: [string, string]; label: string }) => Promise<void> | void;
  onAddCircle: (input: { name: string; memberIds: string[] }) => Promise<void> | void;
  onAddCommitment: (input: {
    title: string;
    note: string;
    dueAt: string;
    assigneeIds: string[];
    visibility: VisibilityScope;
  }) => Promise<void> | void;
  onToggleCommitment: (commitmentId: string) => Promise<void> | void;
  onDeleteCommitment: (commitmentId: string) => Promise<void> | void;
  onRegenerateInviteCode: () => void;
  onCopyInviteCode: () => void;
  onOpenOneSecondUpload: () => void;
  onDeleteOneSecondLog: (logId: string) => void;
  onAddMergedVlogToAlbum: (communityId: string, dateKey: string, videoFile: File) => Promise<void> | void;
}

type CoreContentModule = "feed" | "members";
type OptionalContentModule = Exclude<CommunityModule, CoreContentModule | "messages">;
type FutureContentId = "budget";

interface ContentModuleDefinition {
  module: CoreContentModule | OptionalContentModule;
  icon: LucideIcon;
  label: string;
  description: string;
  eyebrow: string;
}

interface FutureContentDefinition {
  id: FutureContentId;
  icon: LucideIcon;
  label: string;
  description: string;
  eyebrow: string;
}

const CONTENT_STORAGE_KEY = "copula.react.enabledContentModules.v1";
const CORE_CONTENT_MODULES: CoreContentModule[] = ["feed", "members"];
const OPTIONAL_CONTENT_MODULES: OptionalContentModule[] = ["calendar", "commitments", "relationships", "albums", "1s"];

const CORE_CONTENT_DEFINITIONS: ContentModuleDefinition[] = [
  {
    module: "feed",
    icon: Megaphone,
    label: "피드",
    eyebrow: "기본",
    description: "공지와 중요한 활동을 한눈에 봅니다."
  },
  {
    module: "members",
    icon: Users,
    label: "멤버",
    eyebrow: "기본",
    description: "초대, 역할, 멤버 관리를 담당합니다."
  }
];

const OPTIONAL_CONTENT_DEFINITIONS: ContentModuleDefinition[] = [
  {
    module: "calendar",
    icon: CalendarDays,
    label: "일정",
    eyebrow: "생활",
    description: "약속, D-Day, 날짜별 1s 기록을 관리합니다."
  },
  {
    module: "commitments",
    icon: ListTodo,
    label: "할 일",
    eyebrow: "협업",
    description: "멤버별 담당과 마감이 있는 일을 정리합니다."
  },
  {
    module: "relationships",
    icon: Network,
    label: "관계",
    eyebrow: "구성",
    description: "1:1 관계와 그룹별 약속 범위를 만듭니다."
  },
  {
    module: "albums",
    icon: Image,
    label: "앨범",
    eyebrow: "기록",
    description: "사진, 영상, 메모를 copula별로 모읍니다."
  },
  {
    module: "1s",
    icon: Video,
    label: "1s Vlog",
    eyebrow: "일상",
    description: "오늘의 1초 영상을 모아 하루를 남깁니다."
  }
];

const FUTURE_CONTENT_DEFINITIONS: FutureContentDefinition[] = [
  {
    id: "budget",
    icon: Wallet,
    label: "가계부",
    eyebrow: "준비 중",
    description: "공동 지출, 정산, 월별 예산을 함께 관리합니다."
  }
];

export function CommunityScreen({
  communities,
  community: rawCommunity,
  currentUserId,
  activeModule,
  selectedAlbumId,
  onSelectCommunity,
  onModuleChange,
  onSelectAlbum,
  onOpenJoin,
  onOpenCreateCommunity,
  onOpenCommunitySettings,
  onOpenNotice,
  onOpenEvent,
  onOpenAlbum,
  onOpenAlbumItem,
  onOpenAlbumItemDetail,
  onOpenDDay,
  onEditNotice,
  onEditEvent,
  onEditAlbum,
  onEditAlbumItem,
  onEditDDay,
  onDeleteEvent,
  onDeleteAlbum,
  onDeleteAlbumItem,
  onDeleteDDay,
  onDeleteNotice,
  onUpdateMemberRole,
  onRemoveMember,
  canManageRelationships,
  onAddPair,
  onAddCircle,
  onAddCommitment,
  onToggleCommitment,
  onDeleteCommitment,
  onRegenerateInviteCode,
  onCopyInviteCode,
  onOpenOneSecondUpload,
  onDeleteOneSecondLog,
  onAddMergedVlogToAlbum
}: CommunityScreenProps) {
  const [enabledContentMap, setEnabledContentMap] = useState<Record<string, OptionalContentModule[]>>(() => readEnabledContentMap());
  const [isContentManagerOpen, setIsContentManagerOpen] = useState(false);

  useEffect(() => {
    persistEnabledContentMap(enabledContentMap);
  }, [enabledContentMap]);

  if (!rawCommunity) {
    return (
      <section className="section">
        <EmptyState icon={Users} title="참여 중인 copula가 없습니다" body="초대 코드로 참여하거나 copula를 만들어 시작하세요." />
        <div className="button-pair">
          <button className="secondary-button" onClick={onOpenJoin}>초대 코드 입력</button>
          <button className="primary-button" onClick={onOpenCreateCommunity}>copula 만들기</button>
        </div>
      </section>
    );
  }

  const community = {
    ...rawCommunity,
    pairs: rawCommunity.pairs || [],
    circles: rawCommunity.circles || [],
    commitments: rawCommunity.commitments || [],
    messages: rawCommunity.messages || [],
    events: rawCommunity.events || [],
    albums: rawCommunity.albums || [],
    ddays: rawCommunity.ddays || [],
    notices: rawCommunity.notices || [],
    oneSecondLogs: rawCommunity.oneSecondLogs || [],
  };

  const currentMember = community.members.find((member) => member.userId === currentUserId);
  const canManageContent = currentMember?.role === "owner" || currentMember?.role === "admin";
  const enabledContentModules = getEnabledContentModules(community, enabledContentMap[community.id]);
  const activeOptionalModule = isOptionalContentModule(activeModule) ? activeModule : null;
  const activeModuleIsAvailable = activeOptionalModule ? enabledContentModules.includes(activeOptionalModule) : true;

  function addContentModule(module: OptionalContentModule) {
    if (!canManageContent) return;
    setEnabledContentMap((current) => {
      const existingModules = current[community.id] || [];
      const nextModules = uniqueOptionalModules([...existingModules, module]);
      if (nextModules.length === existingModules.length && nextModules.every((item, index) => item === existingModules[index])) {
        return current;
      }
      return {
        ...current,
        [community.id]: nextModules
      };
    });
    onModuleChange(module);
  }

  function openContentManager() {
    setIsContentManagerOpen((current) => !current);
    if (activeModule !== "feed") {
      onModuleChange("feed");
    }
  }

  return (
    <>
      <CommunityHeroStack
        communities={communities}
        activeCommunity={community}
        canManageContent={canManageContent}
        onSelectCommunity={onSelectCommunity}
        onOpenCommunitySettings={onOpenCommunitySettings}
        onCopyInviteCode={onCopyInviteCode}
      />

      {activeModule === "feed" ? (
        <>
          <CommunityHomePanel
            community={community}
            canManageContent={canManageContent}
            isContentManagerOpen={isContentManagerOpen}
            enabledContentModules={enabledContentModules}
            onModuleChange={onModuleChange}
            onToggleContentManager={openContentManager}
            onAddContentModule={addContentModule}
            onOpenNotice={onOpenNotice}
            onOpenEvent={onOpenEvent}
            onOpenAlbum={onOpenAlbum}
            onOpenOneSecondUpload={onOpenOneSecondUpload}
            onCopyInviteCode={onCopyInviteCode}
            onEditNotice={onEditNotice}
            onDeleteNotice={onDeleteNotice}
          />
          <FeedModule
            community={community}
            onModuleChange={onModuleChange}
          />
        </>
      ) : null}
      {activeModule !== "feed" ? (
        <CommunityModuleBar
          module={activeModule}
          onBack={() => onModuleChange("feed")}
          onManageContent={openContentManager}
        />
      ) : null}
      {activeModuleIsAvailable && activeModule === "calendar" ? (
        <CalendarModule
          community={community}
          canManageContent={canManageContent}
          onOpenEvent={onOpenEvent}
          onEditEvent={onEditEvent}
          onDeleteEvent={onDeleteEvent}
          onOpenDDay={onOpenDDay}
          onEditDDay={onEditDDay}
          onDeleteDDay={onDeleteDDay}
          currentUserId={currentUserId}
          onDeleteOneSecondLog={onDeleteOneSecondLog}
          onAddMergedVlogToAlbum={onAddMergedVlogToAlbum}
        />
      ) : null}
      {activeModuleIsAvailable && activeModule === "commitments" ? (
        <CommitmentsModule
          community={community}
          currentUserId={currentUserId}
          onAddCommitment={onAddCommitment}
          onToggleCommitment={onToggleCommitment}
          onDeleteCommitment={onDeleteCommitment}
        />
      ) : null}
      {activeModuleIsAvailable && activeModule === "relationships" ? (
        <RelationshipsModule
          community={community}
          currentUserId={currentUserId}
          canManageRelationships={canManageRelationships}
          onAddPair={onAddPair}
          onAddCircle={onAddCircle}
          onModuleChange={onModuleChange}
        />
      ) : null}
      {activeModuleIsAvailable && activeModule === "albums" ? (
        <AlbumModule
          community={community}
          selectedAlbumId={selectedAlbumId}
          canManageContent={canManageContent}
          onOpenAlbum={onOpenAlbum}
          onSelectAlbum={onSelectAlbum}
          onOpenAlbumItem={onOpenAlbumItem}
          onOpenAlbumItemDetail={onOpenAlbumItemDetail}
          onEditAlbum={onEditAlbum}
          onEditAlbumItem={onEditAlbumItem}
          onDeleteAlbum={onDeleteAlbum}
          onDeleteAlbumItem={onDeleteAlbumItem}
        />
      ) : null}
      {activeModule === "members" ? (
        <MembersModule
          community={community}
          currentUserId={currentUserId}
          onUpdateMemberRole={onUpdateMemberRole}
          onRemoveMember={onRemoveMember}
          onRegenerateInviteCode={onRegenerateInviteCode}
          onCopyInviteCode={onCopyInviteCode}
          onModuleChange={onModuleChange}
        />
      ) : null}
      {activeModuleIsAvailable && activeModule === "1s" ? (
        <OneSecondModule
          community={community}
          currentUserId={currentUserId}
          onOpenOneSecondUpload={onOpenOneSecondUpload}
          onDeleteOneSecondLog={onDeleteOneSecondLog}
          onAddMergedVlogToAlbum={(dateKey, videoFile) => onAddMergedVlogToAlbum(community.id, dateKey, videoFile)}
        />
      ) : null}
      {!activeModuleIsAvailable && activeOptionalModule ? (
        <ContentUnavailablePanel
          module={activeOptionalModule}
          canManageContent={canManageContent}
          onAddContentModule={addContentModule}
        />
      ) : null}
    </>
  );
}

function CommunityHeroStack({
  communities,
  activeCommunity,
  canManageContent,
  onSelectCommunity,
  onOpenCommunitySettings,
  onCopyInviteCode
}: {
  communities: Community[];
  activeCommunity: Community;
  canManageContent: boolean;
  onSelectCommunity: (communityId: string) => void;
  onOpenCommunitySettings: () => void;
  onCopyInviteCode: () => void;
}) {
  const activeIndex = Math.max(0, communities.findIndex((item) => item.id === activeCommunity.id));
  const hasMultipleCommunities = communities.length > 1;
  const previousCommunity = hasMultipleCommunities
    ? communities[(activeIndex - 1 + communities.length) % communities.length]
    : null;
  const nextCommunity = hasMultipleCommunities
    ? communities[(activeIndex + 1) % communities.length]
    : null;
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [dragDeltaX, setDragDeltaX] = useState(0);

  function selectRelativeCommunity(direction: "previous" | "next") {
    const target = direction === "previous" ? previousCommunity : nextCommunity;
    if (target && target.id !== activeCommunity.id) {
      onSelectCommunity(target.id);
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (!hasMultipleCommunities) return;
    setDragStartX(event.clientX);
    setDragDeltaX(0);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    if (dragStartX === null) return;
    setDragDeltaX(event.clientX - dragStartX);
  }

  function finishPointerGesture() {
    if (dragStartX === null) return;
    const threshold = 64;
    const direction = dragDeltaX < -threshold ? "next" : dragDeltaX > threshold ? "previous" : null;
    setDragStartX(null);
    setDragDeltaX(0);
    if (direction) {
      selectRelativeCommunity(direction);
    }
  }

  return (
    <section
      className={`community-hero-stack ${hasMultipleCommunities ? "has-stack" : ""}`}
      aria-label="copula 타이틀"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointerGesture}
      onPointerCancel={finishPointerGesture}
      style={{
        "--accent": activeCommunity.accent,
        "--hero-drag-x": `${Math.max(-84, Math.min(84, dragDeltaX))}px`
      } as CSSProperties}
    >
      {previousCommunity ? <CommunityStackPreview community={previousCommunity} side="left" /> : null}
      {nextCommunity ? <CommunityStackPreview community={nextCommunity} side="right" /> : null}
      <CommunityHeroCard
        community={activeCommunity}
        canManageContent={canManageContent}
        showSwitcherHint={hasMultipleCommunities}
        onOpenCommunitySettings={onOpenCommunitySettings}
        onCopyInviteCode={onCopyInviteCode}
      />
      {hasMultipleCommunities ? (
        <div className="community-stack-indicators" aria-label={`${activeIndex + 1} / ${communities.length}`}>
          {communities.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === activeCommunity.id ? "is-active" : ""}
              onClick={() => onSelectCommunity(item.id)}
              aria-label={`${item.name}로 전환`}
              aria-current={item.id === activeCommunity.id ? "true" : undefined}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function CommunityStackPreview({
  community,
  side
}: {
  community: Community;
  side: "left" | "right";
}) {
  return (
    <div
      className={`community-stack-preview is-${side} ${community.coverUrl ? "has-cover" : "has-gradient"}`}
      aria-hidden="true"
      style={{
        "--accent": community.accent,
        backgroundImage: community.coverUrl ? `url(${community.coverUrl})` : "none"
      } as CSSProperties}
    />
  );
}

function CommunityHeroCard({
  community,
  canManageContent,
  showSwitcherHint,
  onOpenCommunitySettings,
  onCopyInviteCode
}: {
  community: Community;
  canManageContent: boolean;
  showSwitcherHint: boolean;
  onOpenCommunitySettings: () => void;
  onCopyInviteCode: () => void;
}) {
  return (
    <div
      className={`community-hero ${community.coverUrl ? "has-cover" : "has-gradient"}`}
      style={{
        "--accent": community.accent,
        backgroundImage: community.coverUrl ? `url(${community.coverUrl})` : "none"
      } as CSSProperties}
    >
      {community.coverUrl && <div className="community-hero-overlay" />}
      <div className="community-hero-content">
        <div className="community-hero-top">
          <div className="page-head">
            <div className="community-title-line">
              <h1>{community.name}</h1>
              <button
                type="button"
                className="community-invite-code"
                onClick={onCopyInviteCode}
                aria-label={`초대 코드 ${community.inviteCode} 공유`}
                title="초대 링크 공유"
              >
                {community.inviteCode}
              </button>
            </div>
            <p className="muted">{community.description || "소개가 아직 없습니다."}</p>
          </div>
          <div className="community-hero-actions">
            {canManageContent ? (
              <button className="icon-button" onClick={onOpenCommunitySettings} aria-label="copula 설정" title="copula 설정">
                <Settings aria-hidden="true" />
              </button>
            ) : null}
            <button className="icon-button" onClick={onCopyInviteCode} aria-label="초대 링크 공유" title="초대 링크 공유">
              <Share2 aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="community-hero-meta">
          <span className="community-member-pill" aria-label={`멤버 ${community.members.length}명`}>
            <Users aria-hidden="true" />
            {community.members.length}
          </span>
          {showSwitcherHint ? (
            <span className="community-swipe-hint" aria-hidden="true">
              <ChevronLeft />
              <ChevronRight />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CommunityHomePanel({
  community,
  canManageContent,
  isContentManagerOpen,
  enabledContentModules,
  onModuleChange,
  onToggleContentManager,
  onAddContentModule,
  onOpenNotice,
  onOpenEvent,
  onOpenAlbum,
  onOpenOneSecondUpload,
  onCopyInviteCode,
  onEditNotice,
  onDeleteNotice
}: {
  community: Community;
  canManageContent: boolean;
  isContentManagerOpen: boolean;
  enabledContentModules: OptionalContentModule[];
  onModuleChange: (module: CommunityModule) => void;
  onToggleContentManager: () => void;
  onAddContentModule: (module: OptionalContentModule) => void;
  onOpenNotice: () => void;
  onOpenEvent: (dateKey?: string) => void;
  onOpenAlbum: () => void;
  onOpenOneSecondUpload: () => void;
  onCopyInviteCode: () => void;
  onEditNotice: (noticeId: string) => void;
  onDeleteNotice: (noticeId: string) => void;
}) {
  const primaryNotice = sortNotices(community.notices)[0];
  const todayScheduleCount = countTodayScheduleItems(community);
  const openCommitmentCount = community.commitments.filter((item) => item.status === "open").length;
  const todaysVlogCount = (community.oneSecondLogs || []).filter((log) => isSameDate(log.createdAt, new Date())).length;
  const latestAlbum = [...community.albums]
    .sort((a, b) => new Date(getLatestAlbumItem(b)?.createdAt ?? b.createdAt).getTime() - new Date(getLatestAlbumItem(a)?.createdAt ?? a.createdAt).getTime())[0];

  return (
    <section className="copula-home-panel" aria-label="copula 홈">
      <div className="copula-home-head">
        <div>
          <span>{community.members.length}명 함께</span>
          <h2>오늘</h2>
        </div>
        <button
          type="button"
          className="icon-button compact"
          onClick={onToggleContentManager}
          aria-label="콘텐츠 관리"
          title="콘텐츠 관리"
          aria-expanded={isContentManagerOpen}
        >
          <Settings aria-hidden="true" />
        </button>
      </div>

      {primaryNotice ? (
        <NoticePreviewCard
          community={community}
          notice={primaryNotice}
          canManageContent={canManageContent}
          onOpenNotice={onOpenNotice}
          onEditNotice={onEditNotice}
          onDeleteNotice={onDeleteNotice}
        />
      ) : canManageContent ? (
        <button className="copula-notice-preview is-empty" type="button" onClick={onOpenNotice}>
          <Megaphone aria-hidden="true" />
          <span>공지 작성</span>
          <ChevronRight aria-hidden="true" />
        </button>
      ) : null}

      <div className="copula-today-grid" aria-label="오늘 요약">
        <TodayMetricButton icon={CalendarDays} label="일정" value={todayScheduleCount} helper="오늘" onClick={() => onModuleChange("calendar")} />
        <TodayMetricButton icon={ListTodo} label="할 일" value={openCommitmentCount} helper="진행" onClick={() => onModuleChange("commitments")} />
        <TodayMetricButton icon={Video} label="1s" value={todaysVlogCount ? "완료" : "아직"} helper="오늘 기록" onClick={() => onModuleChange("1s")} />
        <TodayMetricButton icon={Image} label="앨범" value={latestAlbum ? latestAlbum.title : "없음"} helper={latestAlbum ? `${latestAlbum.items.length}개` : "최근"} onClick={() => onModuleChange("albums")} />
      </div>

      <div className="copula-action-row" aria-label="빠른 행동">
        <button type="button" onClick={() => onOpenEvent()}>
          <CalendarDays aria-hidden="true" />
          <span>일정</span>
        </button>
        <button type="button" onClick={onOpenAlbum}>
          <Image aria-hidden="true" />
          <span>앨범</span>
        </button>
        <button type="button" onClick={onOpenOneSecondUpload}>
          <Video aria-hidden="true" />
          <span>1s</span>
        </button>
        <button type="button" onClick={onCopyInviteCode}>
          <Users aria-hidden="true" />
          <span>초대</span>
        </button>
      </div>

      {isContentManagerOpen ? (
        <CommunityContentDock
          community={community}
          canManageContent={canManageContent}
          enabledContentModules={enabledContentModules}
          onModuleChange={onModuleChange}
          onAddContentModule={onAddContentModule}
        />
      ) : null}
    </section>
  );
}

function NoticePreviewCard({
  community,
  notice,
  canManageContent,
  onOpenNotice,
  onEditNotice,
  onDeleteNotice
}: {
  community: Community;
  notice: Community["notices"][number];
  canManageContent: boolean;
  onOpenNotice: () => void;
  onEditNotice: (noticeId: string) => void;
  onDeleteNotice: (noticeId: string) => void;
}) {
  return (
    <article className="copula-notice-preview" style={{ "--accent": community.accent } as CSSProperties}>
      <button type="button" className="copula-notice-main" onClick={onOpenNotice}>
        <span className="copula-notice-icon">
          <Megaphone aria-hidden="true" />
        </span>
        <span>
          <small>{notice.pinned ? "고정 공지" : "공지"}</small>
          <strong>{notice.title}</strong>
          <em>{notice.body}</em>
        </span>
      </button>
      {canManageContent ? (
        <span className="copula-notice-actions">
          <button className="row-icon-button" type="button" onClick={() => onEditNotice(notice.id)} aria-label="공지 수정" title="공지 수정">
            <Pencil aria-hidden="true" />
          </button>
          <button className="row-icon-button danger" type="button" onClick={() => onDeleteNotice(notice.id)} aria-label="공지 삭제" title="공지 삭제">
            <Trash2 aria-hidden="true" />
          </button>
        </span>
      ) : null}
    </article>
  );
}

function TodayMetricButton({
  icon: Icon,
  label,
  value,
  helper,
  onClick
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  helper: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="today-metric-button" onClick={onClick}>
      <Icon aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </button>
  );
}

function CommunityModuleBar({
  module,
  onBack,
  onManageContent
}: {
  module: CommunityModule;
  onBack: () => void;
  onManageContent: () => void;
}) {
  const definition = isCoreContentModule(module) || isOptionalContentModule(module)
    ? getContentModuleDefinition(module)
    : CORE_CONTENT_DEFINITIONS[0];
  const Icon = definition.icon;

  return (
    <section className="community-module-bar" aria-label="copula 세부 화면">
      <button type="button" className="secondary-button compact-button" onClick={onBack}>
        <ChevronLeft aria-hidden="true" />
        피드
      </button>
      <div>
        <Icon aria-hidden="true" />
        <strong>{definition.label}</strong>
      </div>
      <button type="button" className="icon-button compact" onClick={onManageContent} aria-label="콘텐츠 관리" title="콘텐츠 관리">
        <Settings aria-hidden="true" />
      </button>
    </section>
  );
}

function CommunityContentDock({
  community,
  canManageContent,
  enabledContentModules,
  onModuleChange,
  onAddContentModule
}: {
  community: Community;
  canManageContent: boolean;
  enabledContentModules: OptionalContentModule[];
  onModuleChange: (module: CommunityModule) => void;
  onAddContentModule: (module: OptionalContentModule) => void;
}) {
  const enabledSet = new Set<CommunityModule>([...CORE_CONTENT_MODULES, ...enabledContentModules]);
  const activeDefinitions = [
    ...CORE_CONTENT_DEFINITIONS,
    ...OPTIONAL_CONTENT_DEFINITIONS.filter((definition) => enabledContentModules.includes(definition.module as OptionalContentModule))
  ];

  return (
    <section className="content-dock is-manager" aria-label="copula 콘텐츠 관리">
      <div className="content-dock-head">
        <div className="content-dock-title">
          <span>콘텐츠 관리</span>
          <strong>사용 중 {activeDefinitions.length}개</strong>
        </div>
      </div>

      <div className="content-active-grid">
        {activeDefinitions.map((definition) => (
          <ContentActiveButton
            key={definition.module}
            definition={definition}
            active={false}
            count={getContentModuleCount(community, definition.module)}
            isCore={isCoreContentModule(definition.module)}
            onClick={() => onModuleChange(definition.module)}
          />
        ))}
      </div>

      <div className="content-catalog-panel">
        <div className="content-catalog-head">
          <span>추가 콘텐츠</span>
          <strong>{canManageContent ? "필요한 것만 켜기" : "관리자만 추가 가능"}</strong>
        </div>
        <div className="content-catalog-grid">
          {OPTIONAL_CONTENT_DEFINITIONS.map((definition) => {
            const isEnabled = enabledSet.has(definition.module);
            const optionalModule = definition.module as OptionalContentModule;
            return (
              <ContentCatalogCard
                key={definition.module}
                icon={definition.icon}
                label={definition.label}
                eyebrow={definition.eyebrow}
                description={definition.description}
                actionLabel={isEnabled ? "열기" : canManageContent ? "추가" : "관리자만"}
                active={isEnabled}
                disabled={!isEnabled && !canManageContent}
                onClick={() => {
                  if (isEnabled) {
                    onModuleChange(definition.module);
                    return;
                  }
                  onAddContentModule(optionalModule);
                }}
              />
            );
          })}
          {FUTURE_CONTENT_DEFINITIONS.map((definition) => (
            <ContentCatalogCard
              key={definition.id}
              icon={definition.icon}
              label={definition.label}
              eyebrow={definition.eyebrow}
              description={definition.description}
              actionLabel="준비 중"
              disabled
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ContentActiveButton({
  definition,
  active,
  count,
  isCore,
  onClick
}: {
  definition: ContentModuleDefinition;
  active: boolean;
  count: number;
  isCore: boolean;
  onClick: () => void;
}) {
  const Icon = definition.icon;
  return (
    <button
      type="button"
      className={`content-active-card ${active ? "is-active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
      title={definition.label}
    >
      <span className="content-module-icon">
        <Icon aria-hidden="true" />
      </span>
      <span className="content-module-copy">
        <strong>{definition.label}</strong>
        <small>{isCore ? "기본" : definition.eyebrow}</small>
      </span>
      <span className="content-module-count">{formatContentModuleCount(count)}</span>
    </button>
  );
}

function ContentCatalogCard({
  icon: Icon,
  label,
  eyebrow,
  description,
  actionLabel,
  active = false,
  disabled = false,
  onClick
}: {
  icon: LucideIcon;
  label: string;
  eyebrow: string;
  description: string;
  actionLabel: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`content-catalog-card ${active ? "is-active" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={`${label} ${actionLabel}`}
    >
      <span className="content-catalog-icon">
        <Icon aria-hidden="true" />
      </span>
      <span className="content-catalog-main">
        <small>{eyebrow}</small>
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
      <span className="content-catalog-action">{actionLabel}</span>
    </button>
  );
}

function ContentUnavailablePanel({
  module,
  canManageContent,
  onAddContentModule
}: {
  module: OptionalContentModule;
  canManageContent: boolean;
  onAddContentModule: (module: OptionalContentModule) => void;
}) {
  const definition = getContentModuleDefinition(module);
  const Icon = definition.icon;

  return (
    <section className="content-unavailable-panel">
      <span className="content-unavailable-icon">
        <Icon aria-hidden="true" />
      </span>
      <div>
        <span>{definition.eyebrow}</span>
        <h2>{definition.label} 콘텐츠가 아직 없습니다</h2>
        <p>{canManageContent ? "필요한 copula에서만 추가해 사용할 수 있습니다." : "관리자가 이 콘텐츠를 추가하면 사용할 수 있습니다."}</p>
      </div>
      {canManageContent ? (
        <button className="primary-button compact-button" type="button" onClick={() => onAddContentModule(module)}>
          <Plus aria-hidden="true" />
          콘텐츠 추가
        </button>
      ) : null}
    </section>
  );
}

function readEnabledContentMap(): Record<string, OptionalContentModule[]> {
  if (typeof window === "undefined") return {};
  try {
    const rawValue = window.localStorage.getItem(CONTENT_STORAGE_KEY);
    if (!rawValue) return {};
    const parsedValue: unknown = JSON.parse(rawValue);
    if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) return {};
    return Object.entries(parsedValue).reduce<Record<string, OptionalContentModule[]>>((result, [communityId, modules]) => {
      const normalizedModules = normalizeEnabledModules(modules);
      if (normalizedModules.length) {
        result[communityId] = normalizedModules;
      }
      return result;
    }, {});
  } catch {
    return {};
  }
}

function persistEnabledContentMap(map: Record<string, OptionalContentModule[]>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(map));
}

function normalizeEnabledModules(modules: unknown): OptionalContentModule[] {
  if (!Array.isArray(modules)) return [];
  return uniqueOptionalModules(
    modules.filter((module): module is OptionalContentModule => typeof module === "string" && isOptionalContentModule(module))
  );
}

function uniqueOptionalModules(modules: readonly OptionalContentModule[]) {
  const moduleSet = new Set(modules);
  return OPTIONAL_CONTENT_MODULES.filter((module) => moduleSet.has(module));
}

function getEnabledContentModules(community: Community, savedModules: OptionalContentModule[] = []) {
  const modulesWithContent = OPTIONAL_CONTENT_MODULES.filter((module) => hasExistingContent(community, module));
  return uniqueOptionalModules([...savedModules, ...modulesWithContent]);
}

function isCoreContentModule(module: string): module is CoreContentModule {
  return (CORE_CONTENT_MODULES as readonly string[]).includes(module);
}

function isOptionalContentModule(module: string): module is OptionalContentModule {
  return (OPTIONAL_CONTENT_MODULES as readonly string[]).includes(module);
}

function hasExistingContent(community: Community, module: OptionalContentModule) {
  switch (module) {
    case "calendar":
      return community.events.length > 0 || community.ddays.length > 0;
    case "commitments":
      return community.commitments.length > 0;
    case "relationships":
      return community.pairs.length > 0 || community.circles.length > 0;
    case "albums":
      return community.albums.length > 0;
    case "1s":
      return community.oneSecondLogs.length > 0;
  }
}

function getContentModuleCount(community: Community, module: CoreContentModule | OptionalContentModule) {
  switch (module) {
    case "feed":
      return buildCopulaContentItems(community).length;
    case "members":
      return community.members.length;
    case "calendar":
      return community.events.length + community.ddays.length;
    case "commitments":
      return community.commitments.length;
    case "relationships":
      return community.pairs.length + community.circles.length;
    case "albums":
      return community.albums.length;
    case "1s":
      return community.oneSecondLogs.length;
  }
}

function formatContentModuleCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

function getContentModuleDefinition(module: CoreContentModule | OptionalContentModule) {
  return [...CORE_CONTENT_DEFINITIONS, ...OPTIONAL_CONTENT_DEFINITIONS].find((definition) => definition.module === module) || CORE_CONTENT_DEFINITIONS[0];
}

type CopulaContentFilter = "all" | "notice" | "schedule" | "commitment" | "album" | "vlog";

interface CopulaContentItem {
  id: string;
  filter: CopulaContentFilter;
  module: CommunityModule;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  meta: string;
  body?: string;
  at: string;
  priority: number;
  mediaUrl?: string;
  mediaKind?: "photo" | "video";
}

function FeedModule({
  community,
  onModuleChange
}: {
  community: Community;
  onModuleChange: (module: CommunityModule) => void;
}) {
  const [activeFilter, setActiveFilter] = useState<CopulaContentFilter>("all");
  const contentItems = buildCopulaContentItems(community);
  const filteredItems = activeFilter === "all"
    ? contentItems
    : contentItems.filter((item) => item.filter === activeFilter);
  const filters: Array<{ id: CopulaContentFilter; label: string; count: number }> = [
    { id: "all", label: "전체", count: contentItems.length },
    { id: "notice", label: "공지", count: contentItems.filter((item) => item.filter === "notice").length },
    { id: "schedule", label: "일정", count: contentItems.filter((item) => item.filter === "schedule").length },
    { id: "commitment", label: "할 일", count: contentItems.filter((item) => item.filter === "commitment").length },
    { id: "album", label: "앨범", count: contentItems.filter((item) => item.filter === "album").length },
    { id: "vlog", label: "1s", count: contentItems.filter((item) => item.filter === "vlog").length }
  ];

  return (
    <section className="copula-content-panel">
      <div className="copula-content-head">
        <div>
          <h2>최근 활동</h2>
          <span>{contentItems.length}개 항목</span>
        </div>
      </div>
      <div className="copula-filter-row" role="tablist" aria-label="콘텐츠 필터">
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={activeFilter === filter.id ? "is-active" : ""}
            onClick={() => setActiveFilter(filter.id)}
            role="tab"
            aria-selected={activeFilter === filter.id}
          >
            {filter.label}
            <span>{filter.count}</span>
          </button>
        ))}
      </div>
      <div className="copula-content-list">
        {filteredItems.length ? (
          filteredItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`copula-content-item content-${item.filter}`}
              onClick={() => onModuleChange(item.module)}
            >
              <span className="copula-content-icon">
                <item.icon aria-hidden="true" />
              </span>
              <span className="copula-content-main">
                <span className="copula-content-eyebrow">{item.eyebrow}</span>
                <strong>{item.title}</strong>
                <span>{item.meta}</span>
                {item.body ? <small>{item.body}</small> : null}
              </span>
              {item.mediaUrl ? (
                <span className="copula-content-media">
                  {item.mediaKind === "video" ? (
                    <video src={item.mediaUrl} muted playsInline />
                  ) : (
                    <img src={item.mediaUrl} alt="" />
                  )}
                </span>
              ) : null}
              <ChevronRight className="copula-content-chevron" aria-hidden="true" />
            </button>
          ))
        ) : (
          <EmptyState icon={Clock} title="표시할 활동이 없습니다" body="일정, 할 일, 앨범이나 1s 기록이 추가되면 이곳에 모입니다." />
        )}
      </div>
    </section>
  );
}

function buildCopulaContentItems(community: Community): CopulaContentItem[] {
  const noticeItems: CopulaContentItem[] = [...community.notices]
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((notice) => ({
      id: `notice-${notice.id}`,
      filter: "notice",
      module: "feed",
      icon: Megaphone,
      eyebrow: notice.pinned ? "고정 공지" : "공지",
      title: notice.title,
      meta: formatContentDate(notice.createdAt),
      body: notice.body,
      at: notice.createdAt,
      priority: notice.pinned ? 1 : 20
    }));

  const eventItems: CopulaContentItem[] = community.events.map((event) => {
    const startsAt = new Date(event.startsAt).getTime();
    const isPast = startsAt < startOfDate(new Date()).getTime();
    return {
      id: `event-${event.id}`,
      filter: "schedule",
      module: "calendar",
      icon: CalendarDays,
      eyebrow: isSameDate(event.startsAt, new Date()) ? "오늘 일정" : "일정",
      title: event.title,
      meta: formatContentDateTime(event.startsAt),
      body: event.location || event.notes || undefined,
      at: event.startsAt,
      priority: isPast ? 70 : isSameDate(event.startsAt, new Date()) ? 5 : 12
    };
  });

  const ddayItems: CopulaContentItem[] = community.ddays.map((dday) => ({
    id: `dday-${dday.id}`,
    filter: "schedule",
    module: "calendar",
    icon: Flag,
    eyebrow: "D-Day",
    title: dday.title,
    meta: `${ddayLabel(dday.targetDate)} · ${formatContentDate(dday.targetDate)}`,
    body: dday.note || dday.kind,
    at: dday.targetDate,
    priority: isSameDate(dday.targetDate, new Date()) ? 6 : 18
  }));

  const commitmentItems: CopulaContentItem[] = community.commitments
    .filter((commitment) => commitment.status === "open")
    .map((commitment) => {
      const dueAt = new Date(commitment.dueAt).getTime();
      const isOverdue = dueAt < startOfDate(new Date()).getTime();
      return {
        id: `commitment-${commitment.id}`,
        filter: "commitment",
        module: "commitments",
        icon: ListTodo,
        eyebrow: isOverdue ? "지난 할 일" : "할 일",
        title: commitment.title,
        meta: `${formatDueDate(commitment.dueAt)} · ${formatMemberNames(community, commitment.assigneeIds) || "담당자 없음"}`,
        body: describeVisibility(community, commitment.visibility),
        at: commitment.dueAt,
        priority: isOverdue ? 4 : isSameDate(commitment.dueAt, new Date()) ? 7 : 16
      };
    });

  const albumItems: CopulaContentItem[] = community.albums.map((album) => {
    const coverItem = getAlbumCoverItem(album);
    const latestItem = getLatestAlbumItem(album);
    return {
      id: `album-${album.id}`,
      filter: "album",
      module: "albums",
      icon: Image,
      eyebrow: "앨범",
      title: album.title,
      meta: `${album.items.length}개 사진·메모`,
      body: latestItem?.title || album.description || undefined,
      at: latestItem?.createdAt ?? album.createdAt,
      priority: 42,
      mediaUrl: coverItem?.mediaUrl,
      mediaKind: coverItem?.kind === "video" ? "video" : coverItem?.mediaUrl ? "photo" : undefined
    };
  });

  const vlogItems: CopulaContentItem[] = (community.oneSecondLogs || []).map((log) => ({
    id: `vlog-${log.id}`,
    filter: "vlog",
    module: "1s",
    icon: Video,
    eyebrow: "1s Vlog",
    title: log.caption || "1초 기록",
    meta: `${log.userName} · ${formatContentDate(log.createdAt)}`,
    at: log.createdAt,
    priority: isSameDate(log.createdAt, new Date()) ? 22 : 46,
    mediaUrl: log.videoUrl,
    mediaKind: "video"
  }));

  return [...noticeItems, ...eventItems, ...ddayItems, ...commitmentItems, ...albumItems, ...vlogItems].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    const aTime = new Date(a.at).getTime();
    const bTime = new Date(b.at).getTime();
    if (a.filter === "album" || a.filter === "vlog") {
      return bTime - aTime;
    }
    return aTime - bTime;
  });
}

function countTodayScheduleItems(community: Community) {
  return (
    community.events.filter((event) => isSameDate(event.startsAt, new Date())).length +
    community.ddays.filter((dday) => isSameDate(dday.targetDate, new Date())).length
  );
}

function isSameDate(value: string, date: Date) {
  const target = new Date(value);
  return (
    target.getFullYear() === date.getFullYear() &&
    target.getMonth() === date.getMonth() &&
    target.getDate() === date.getDate()
  );
}

function startOfDate(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatContentDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short"
  }).format(new Date(value));
}

function formatContentDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function MiniLabel({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="field-label">
      <Icon aria-hidden="true" />
      {label}
    </span>
  );
}

function RelationshipsModule({
  community,
  currentUserId,
  canManageRelationships,
  onAddPair,
  onAddCircle,
  onModuleChange
}: {
  community: Community;
  currentUserId: string;
  canManageRelationships: boolean;
  onAddPair: (input: { memberIds: [string, string]; label: string }) => Promise<void> | void;
  onAddCircle: (input: { name: string; memberIds: string[] }) => Promise<void> | void;
  onModuleChange: (module: CommunityModule) => void;
}) {
  const currentMember = community.members.find((member) => member.userId === currentUserId);
  const [firstMemberId, setFirstMemberId] = useState(community.members[0]?.id ?? "");
  const [secondMemberId, setSecondMemberId] = useState(community.members[1]?.id ?? "");
  const [pairLabel, setPairLabel] = useState("");
  const [circleName, setCircleName] = useState("");
  const [circleMemberIds, setCircleMemberIds] = useState<string[]>(community.members.slice(0, 3).map((member) => member.id));
  const [selectedPairId, setSelectedPairId] = useState(community.pairs[0]?.id ?? "");
  const [selectedCircleId, setSelectedCircleId] = useState(community.circles[0]?.id ?? "");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canCreatePair = community.members.length >= 2 && firstMemberId && secondMemberId && firstMemberId !== secondMemberId;
  const canCreateCircle = circleName.trim().length > 0 && circleMemberIds.length > 0;
  const selectedPair = community.pairs.find((pair) => pair.id === selectedPairId) ?? community.pairs[0] ?? null;
  const selectedCircle = community.circles.find((circle) => circle.id === selectedCircleId) ?? community.circles[0] ?? null;
  const activityItems = buildRelationshipActivity(community).slice(0, 8);

  async function submitPair(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreatePair) {
      setError("1:1 관계는 서로 다른 두 멤버가 필요합니다.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      await onAddPair({
        memberIds: [firstMemberId, secondMemberId],
        label: pairLabel.trim() || `${memberName(community, firstMemberId)} ↔ ${memberName(community, secondMemberId)}`
      });
      setPairLabel("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "관계를 추가하지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitCircle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreateCircle) {
      setError("그룹 이름과 멤버를 선택해 주세요.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      await onAddCircle({
        name: circleName.trim(),
        memberIds: circleMemberIds
      });
      setCircleName("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "그룹을 추가하지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleCircleMember(memberId: string) {
    setCircleMemberIds((current) =>
      current.includes(memberId)
        ? current.filter((item) => item !== memberId)
        : [...current, memberId]
    );
  }

  return (
    <>
      <section className="relationship-stats">
        <div>
          <Handshake aria-hidden="true" />
          <strong>{community.pairs.length}</strong>
          <span>1:1 관계</span>
        </div>
        <div>
          <Network aria-hidden="true" />
          <strong>{community.circles.length}</strong>
          <span>1:N 그룹</span>
        </div>
        <button className="secondary-button" onClick={() => onModuleChange("commitments")}>
          <ListTodo aria-hidden="true" />
          약속으로 이동
        </button>
      </section>

      {canManageRelationships ? (
        <section className="relationship-grid">
          <form className="relationship-form-card" onSubmit={submitPair}>
            <SectionTitle title="1:1" action={<Handshake aria-hidden="true" />} />
            <div className="form-grid">
              <label>
                <MiniLabel icon={UserRound} label="A" />
                <select value={firstMemberId} onChange={(event) => setFirstMemberId(event.currentTarget.value)}>
                  {community.members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <MiniLabel icon={UserRound} label="B" />
                <select value={secondMemberId} onChange={(event) => setSecondMemberId(event.currentTarget.value)}>
                  {community.members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <MiniLabel icon={Handshake} label="이름" />
                <input
                  value={pairLabel}
                  onChange={(event) => setPairLabel(event.currentTarget.value)}
                  placeholder="여행 룸메이트"
                />
              </label>
              <button className="primary-button" disabled={!canCreatePair || isSubmitting}>
                <Plus aria-hidden="true" />
                추가
              </button>
            </div>
          </form>

          <form className="relationship-form-card" onSubmit={submitCircle}>
            <SectionTitle title="그룹" action={<Network aria-hidden="true" />} />
            <div className="form-grid">
              <label>
                <MiniLabel icon={Network} label="이름" />
                <input
                  value={circleName}
                  onChange={(event) => setCircleName(event.currentTarget.value)}
                  placeholder="제주 준비팀"
                />
              </label>
              <fieldset className="member-checklist">
                <legend><MiniLabel icon={Users} label="멤버" /></legend>
                {community.members.map((member) => (
                  <label key={member.id} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={circleMemberIds.includes(member.id)}
                      onChange={() => toggleCircleMember(member.id)}
                    />
                    <span>{member.name}</span>
                  </label>
                ))}
              </fieldset>
              <button className="primary-button" disabled={!canCreateCircle || isSubmitting}>
                <Plus aria-hidden="true" />
                추가
              </button>
            </div>
          </form>
        </section>
      ) : (
        <p className="status-banner">1:1 관계와 그룹 생성은 소유자 또는 관리자가 할 수 있습니다.</p>
      )}

      {error ? <p className="form-error">{error}</p> : null}

      <section className="section">
        <SectionTitle title="관계 목록" />
        <div className="relationship-grid">
          {community.pairs.length ? (
            community.pairs.map((pair) => (
              <RelationshipCard
                key={pair.id}
                icon={Handshake}
                title={pair.label}
                body={pair.memberIds.map((memberId) => memberName(community, memberId)).join(" · ")}
                meta="1:1"
                active={pair.id === selectedPair?.id}
                onClick={() => setSelectedPairId(pair.id)}
              />
            ))
          ) : (
            <EmptyState icon={Handshake} title="아직 1:1 관계가 없습니다" body="두 멤버의 약속을 별도로 관리할 수 있습니다." />
          )}
          {community.circles.length ? (
            community.circles.map((circle) => (
              <RelationshipCard
                key={circle.id}
                icon={Network}
                title={circle.name}
                body={formatMemberNames(community, circle.memberIds)}
                meta={`${circle.memberIds.length}명`}
                active={circle.id === selectedCircle?.id}
                onClick={() => setSelectedCircleId(circle.id)}
              />
            ))
          ) : (
            <EmptyState icon={Network} title="아직 그룹이 없습니다" body="목적별로 멤버를 묶어 약속을 관리하세요." />
          )}
        </div>
      </section>

      <section className="relationship-grid">
        <RelationshipDetail
          community={community}
          title={selectedPair?.label ?? "선택된 1:1 관계"}
          icon={Handshake}
          memberIds={selectedPair?.memberIds ?? []}
          commitments={selectedPair ? commitmentsForScope(community, { type: "pair", pairId: selectedPair.id }) : []}
        />
        <RelationshipDetail
          community={community}
          title={selectedCircle?.name ?? "선택된 그룹"}
          icon={Network}
          memberIds={selectedCircle?.memberIds ?? []}
          commitments={selectedCircle ? commitmentsForScope(community, { type: "circle", circleId: selectedCircle.id }) : []}
        />
      </section>

      <section className="section">
        <SectionTitle title="나와 멤버의 1:1" />
        <div className="relationship-grid">
          {community.members
            .filter((member) => member.id !== currentMember?.id)
            .map((member) => (
              <MemberRelationshipSummary
                key={member.id}
                community={community}
                currentMemberId={currentMember?.id}
                memberId={member.id}
              />
            ))}
        </div>
      </section>

      <section className="section">
        <SectionTitle title="최근 관계 활동" />
        <div className="activity-list">
          {activityItems.length ? (
            activityItems.map((item) => (
              <article key={item.id} className="activity-item">
                <span className="relationship-card-icon">
                  <item.icon aria-hidden="true" />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                </div>
              </article>
            ))
          ) : (
            <EmptyState icon={Clock} title="아직 기록된 활동이 없습니다" body="관계와 약속이 추가되면 최근 흐름이 표시됩니다." />
          )}
        </div>
      </section>
    </>
  );
}

function RelationshipCard({
  icon: Icon,
  title,
  body,
  meta,
  active = false,
  onClick
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  meta: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`relationship-card ${active ? "is-active" : ""}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <span className="relationship-card-icon">
        <Icon aria-hidden="true" />
      </span>
      <div>
        <strong>{title}</strong>
        <span>{body}</span>
      </div>
      <span className="scope-pill">{meta}</span>
    </button>
  );
}

function RelationshipDetail({
  community,
  title,
  icon: Icon,
  memberIds,
  commitments
}: {
  community: Community;
  title: string;
  icon: LucideIcon;
  memberIds: string[];
  commitments: Community["commitments"];
}) {
  return (
    <article className="relationship-detail-card">
      <div className="relationship-detail-head">
        <span className="relationship-card-icon">
          <Icon aria-hidden="true" />
        </span>
        <div>
          <strong>{title}</strong>
          <span>{memberIds.length ? formatMemberNames(community, memberIds) : "관계를 선택해 주세요"}</span>
        </div>
      </div>
      <div className="compact-commitment-list">
        {commitments.length ? (
          commitments.slice(0, 4).map((commitment) => (
            <div key={commitment.id} className="compact-commitment">
              <strong>{commitment.title}</strong>
              <span>{formatDueDate(commitment.dueAt)} · {formatMemberNames(community, commitment.assigneeIds) || "담당자 없음"}</span>
            </div>
          ))
        ) : (
          <span className="small muted">진행 중인 약속이 없습니다.</span>
        )}
      </div>
    </article>
  );
}

function MemberRelationshipSummary({
  community,
  currentMemberId,
  memberId
}: {
  community: Community;
  currentMemberId: string | undefined;
  memberId: string;
}) {
  const member = community.members.find((item) => item.id === memberId);
  const pair = currentMemberId
    ? community.pairs.find((item) => item.memberIds.includes(currentMemberId) && item.memberIds.includes(memberId))
    : null;
  const commitments = pair ? commitmentsForScope(community, { type: "pair", pairId: pair.id }) : [];

  return (
    <article className="relationship-detail-card">
      <div className="relationship-detail-head">
        <span className="relationship-card-icon">
          <UserRound aria-hidden="true" />
        </span>
        <div>
          <strong>{member?.name ?? "멤버"}</strong>
          <span>{pair ? pair.label : "연결된 1:1 관계 없음"}</span>
        </div>
      </div>
      <span className="scope-pill">{commitments.length}개 약속</span>
    </article>
  );
}

function CommitmentsModule({
  community,
  currentUserId,
  onAddCommitment,
  onToggleCommitment,
  onDeleteCommitment
}: {
  community: Community;
  currentUserId: string;
  onAddCommitment: (input: {
    title: string;
    note: string;
    dueAt: string;
    assigneeIds: string[];
    visibility: VisibilityScope;
  }) => Promise<void> | void;
  onToggleCommitment: (commitmentId: string) => Promise<void> | void;
  onDeleteCommitment: (commitmentId: string) => Promise<void> | void;
}) {
  const currentMember = community.members.find((member) => member.userId === currentUserId);
  const [filter, setFilter] = useState<CommitmentFilter>("open");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState(toDateKey(new Date()));
  const [visibilityValue, setVisibilityValue] = useState("community");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(currentMember ? [currentMember.id] : community.members[0] ? [community.members[0].id] : []);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const openCommitments = community.commitments.filter((commitment) => commitment.status === "open");
  const completedCommitments = community.commitments.filter((commitment) => commitment.status === "done");
  const myCommitments = community.commitments.filter((commitment) =>
    currentMember ? commitment.assigneeIds.includes(currentMember.id) && commitment.status === "open" : false
  );
  const dueSoonCommitments = openCommitments.filter((commitment) => isDueWithin(commitment.dueAt, 1));
  const visibleCommitments = community.commitments.filter((commitment) =>
    matchesCommitmentFilter(commitment, filter, currentMember?.id)
  );

  async function submitCommitment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setError("약속 제목을 입력해 주세요.");
      return;
    }
    if (!assigneeIds.length) {
      setError("담당자를 1명 이상 선택해 주세요.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      await onAddCommitment({
        title,
        note,
        dueAt: new Date(`${dueDate}T09:00:00`).toISOString(),
        assigneeIds,
        visibility: visibilityFromValue(visibilityValue)
      });
      setTitle("");
      setNote("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "약속을 추가하지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function toggleAssignee(memberId: string) {
    setAssigneeIds((current) =>
      current.includes(memberId)
        ? current.filter((item) => item !== memberId)
        : [...current, memberId]
    );
  }

  function changeVisibility(value: string) {
    setVisibilityValue(value);
    setAssigneeIds(defaultAssigneeIdsForVisibilityValue(value, community, currentMember?.id));
  }

  return (
    <>
      <section className="relationship-stats">
        <div>
          <CircleDot aria-hidden="true" />
          <strong>{openCommitments.length}</strong>
          <span>진행 중</span>
        </div>
        <div>
          <CheckCircle2 aria-hidden="true" />
          <strong>{myCommitments.length}</strong>
          <span>내 담당</span>
        </div>
        <div>
          <Clock aria-hidden="true" />
          <strong>{dueSoonCommitments.length}</strong>
          <span>오늘·내일</span>
        </div>
      </section>

      <section className="section">
        <SectionTitle title="약속" />
        <form className="relationship-form-card commitment-form" onSubmit={submitCommitment}>
          <div className="form-grid">
            <label>
              <MiniLabel icon={ListTodo} label="제목" />
              <input
                value={title}
                onChange={(event) => setTitle(event.currentTarget.value)}
                placeholder="장소 후보 공유"
              />
            </label>
            <div className="two-column-form">
              <label>
                <MiniLabel icon={Handshake} label="범위" />
                <select value={visibilityValue} onChange={(event) => changeVisibility(event.currentTarget.value)}>
                  <option value="community">이 copula 전체</option>
                  <option value="private">비공개</option>
                  {community.pairs.map((pair) => (
                    <option key={pair.id} value={`pair:${pair.id}`}>
                      1:1 · {pair.label}
                    </option>
                  ))}
                  {community.circles.map((circle) => (
                    <option key={circle.id} value={`circle:${circle.id}`}>
                      그룹 · {circle.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <MiniLabel icon={Clock} label="마감" />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.currentTarget.value)}
                />
              </label>
            </div>
            <fieldset className="member-checklist">
              <legend><MiniLabel icon={Users} label="담당" /></legend>
              {community.members.map((member) => (
                <label key={member.id} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={assigneeIds.includes(member.id)}
                    onChange={() => toggleAssignee(member.id)}
                  />
                  <span>{member.name}</span>
                </label>
              ))}
            </fieldset>
            <label>
              <MiniLabel icon={Megaphone} label="메모" />
              <textarea
                value={note}
                onChange={(event) => setNote(event.currentTarget.value)}
                placeholder="선택 입력"
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="primary-button" disabled={isSubmitting || !title.trim() || !assigneeIds.length}>
              <Plus aria-hidden="true" />
              등록
            </button>
          </div>
        </form>
      </section>

      <section className="section">
        <SectionTitle
          title="약속 목록"
          action={
            <span className="scope-pill">완료 {completedCommitments.length}개</span>
          }
        />
        <div className="filter-strip" role="group" aria-label="약속 필터">
          <FilterButton active={filter === "open"} label="진행 중" onClick={() => setFilter("open")} />
          <FilterButton active={filter === "mine"} label="내 담당" onClick={() => setFilter("mine")} />
          <FilterButton active={filter === "due"} label="임박" onClick={() => setFilter("due")} />
          <FilterButton active={filter === "pair"} label="1:1" onClick={() => setFilter("pair")} />
          <FilterButton active={filter === "circle"} label="그룹" onClick={() => setFilter("circle")} />
          <FilterButton active={filter === "done"} label="완료" onClick={() => setFilter("done")} />
        </div>
        <div className="list">
          {visibleCommitments.length ? (
            [...visibleCommitments].sort(sortCommitments).map((commitment) => {
              const canToggle = canToggleCommitment(community, commitment, currentUserId);
              const canDelete = canDeleteCommitment(community, commitment, currentUserId);
              return (
              <article key={commitment.id} className={`commitment-card is-${commitment.status}`}>
                <button
                  className="commitment-check"
                  onClick={() => {
                    if (commitment.status === "open") {
                      triggerConfetti();
                      playChimeSound();
                    }
                    onToggleCommitment(commitment.id);
                  }}
                  disabled={!canToggle}
                  aria-label={commitment.status === "done" ? "약속 다시 열기" : "약속 완료"}
                  title={canToggle ? undefined : "담당자, 작성자 또는 관리자만 완료 상태를 변경할 수 있습니다"}
                >
                  {commitment.status === "done" ? <CheckCircle2 aria-hidden="true" /> : <CircleDot aria-hidden="true" />}
                </button>
                <div className="commitment-main">
                  <div className="commitment-head">
                    <strong>{commitment.title}</strong>
                    <span className="scope-pill">{describeVisibility(community, commitment.visibility)}</span>
                  </div>
                  <span className="small">
                    {formatDueDate(commitment.dueAt)} · {formatMemberNames(community, commitment.assigneeIds) || "담당자 없음"}
                  </span>
                  {commitment.note ? <p>{commitment.note}</p> : null}
                </div>
                <button
                  className="icon-button compact danger-icon"
                  onClick={() => onDeleteCommitment(commitment.id)}
                  disabled={!canDelete}
                  aria-label="약속 삭제"
                  title={canDelete ? "약속 삭제" : "작성자 또는 관리자만 삭제할 수 있습니다"}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </article>
              );
            })
          ) : (
            <EmptyState icon={ListTodo} title="조건에 맞는 약속이 없습니다" body="필터를 변경하거나 새 약속을 등록하세요." />
          )}
        </div>
      </section>
    </>
  );
}

type CommitmentFilter = "open" | "mine" | "due" | "pair" | "circle" | "done";

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

function matchesCommitmentFilter(
  commitment: Community["commitments"][number],
  filter: CommitmentFilter,
  currentMemberId: string | undefined
) {
  if (filter === "done") return commitment.status === "done";
  if (commitment.status !== "open") return false;
  if (filter === "mine") return Boolean(currentMemberId && commitment.assigneeIds.includes(currentMemberId));
  if (filter === "due") return isDueWithin(commitment.dueAt, 1);
  if (filter === "pair") return commitment.visibility && commitment.visibility.type === "pair";
  if (filter === "circle") return commitment.visibility && commitment.visibility.type === "circle";
  return true;
}

function canToggleCommitment(
  community: Community,
  commitment: Community["commitments"][number],
  currentUserId: string
) {
  const actor = community.members.find((member) => member.userId === currentUserId);
  return Boolean(
    actor &&
      (actor.role === "owner" ||
        actor.role === "admin" ||
        commitment.createdByUserId === currentUserId ||
        commitment.assigneeIds.includes(actor.id))
  );
}

function canDeleteCommitment(
  community: Community,
  commitment: Community["commitments"][number],
  currentUserId: string
) {
  const actor = community.members.find((member) => member.userId === currentUserId);
  return Boolean(
    actor &&
      (actor.role === "owner" || actor.role === "admin" || commitment.createdByUserId === currentUserId)
  );
}

function isDueWithin(value: string, days: number) {
  const today = startOfLocalDay(new Date()).getTime();
  const due = startOfLocalDay(new Date(value)).getTime();
  const diff = Math.round((due - today) / 86_400_000);
  return diff >= 0 && diff <= days;
}

function visibilityFromValue(value: string): VisibilityScope {
  if (value.startsWith("pair:")) {
    return { type: "pair", pairId: value.slice("pair:".length) };
  }
  if (value.startsWith("circle:")) {
    return { type: "circle", circleId: value.slice("circle:".length) };
  }
  if (value === "private") {
    return { type: "private" };
  }
  return { type: "community" };
}

function defaultAssigneeIdsForVisibilityValue(
  value: string,
  community: Community,
  currentMemberId: string | undefined
) {
  if (value.startsWith("pair:")) {
    const pairId = value.slice("pair:".length);
    return community.pairs.find((pair) => pair.id === pairId)?.memberIds ?? [];
  }
  if (value.startsWith("circle:")) {
    const circleId = value.slice("circle:".length);
    return community.circles.find((circle) => circle.id === circleId)?.memberIds ?? [];
  }
  if (value === "private") {
    return currentMemberId ? [currentMemberId] : [];
  }

  return currentMemberId ? [currentMemberId] : community.members[0] ? [community.members[0].id] : [];
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

function commitmentsForScope(community: Community, visibility: VisibilityScope) {
  return community.commitments
    .filter((commitment) => commitment.status === "open" && sameVisibility(commitment.visibility, visibility))
    .sort(sortCommitments);
}

function sameVisibility(left: VisibilityScope, right: VisibilityScope) {
  if (left.type !== right.type) return false;
  if (left.type === "pair" && right.type === "pair") return left.pairId === right.pairId;
  if (left.type === "circle" && right.type === "circle") return left.circleId === right.circleId;
  return left.type === right.type;
}

function buildRelationshipActivity(community: Community) {
  const pairItems = community.pairs.map((pair) => ({
    id: `pair-${pair.id}`,
    icon: Handshake,
    title: "1:1 관계 추가",
    body: `${pair.label} · ${pair.memberIds.map((memberId) => memberName(community, memberId)).join(" · ")}`,
    at: pair.createdAt
  }));
  const circleItems = community.circles.map((circle) => ({
    id: `circle-${circle.id}`,
    icon: Network,
    title: "그룹 추가",
    body: `${circle.name} · ${formatMemberNames(community, circle.memberIds)}`,
    at: circle.createdAt
  }));
  const commitmentItems = community.commitments.flatMap((commitment) => [
    {
      id: `commitment-${commitment.id}`,
      icon: ListTodo,
      title: "약속 등록",
      body: `${describeVisibility(community, commitment.visibility)} · ${commitment.title}`,
      at: commitment.createdAt
    },
    ...(commitment.completedAt
      ? [
          {
            id: `commitment-done-${commitment.id}`,
            icon: CheckCircle2,
            title: "약속 완료",
            body: commitment.title,
            at: commitment.completedAt
          }
        ]
      : [])
  ]);

  return [...pairItems, ...circleItems, ...commitmentItems].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );
}

function memberName(community: Community, memberId: string) {
  return community.members.find((member) => member.id === memberId)?.name ?? "멤버";
}

function formatMemberNames(community: Community, memberIds: string[]) {
  return memberIds.map((memberId) => memberName(community, memberId)).join(" · ");
}

function sortCommitments(a: Community["commitments"][number], b: Community["commitments"][number]) {
  if (a.status !== b.status) {
    return a.status === "open" ? -1 : 1;
  }

  return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
}

function formatDueDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short"
  }).format(new Date(value));
}

function sortNotices(notices: Community["notices"]) {
  return [...notices].sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function CalendarModule({
  community,
  canManageContent,
  onOpenEvent,
  onEditEvent,
  onDeleteEvent,
  onOpenDDay,
  onEditDDay,
  onDeleteDDay,
  currentUserId,
  onDeleteOneSecondLog,
  onAddMergedVlogToAlbum
}: {
  community: Community;
  canManageContent: boolean;
  onOpenEvent: (dateKey?: string) => void;
  onEditEvent: (eventId: string) => void;
  onDeleteEvent: (eventId: string) => void;
  onOpenDDay: () => void;
  onEditDDay: (ddayId: string) => void;
  onDeleteDDay: (ddayId: string) => void;
  currentUserId: string;
  onDeleteOneSecondLog: (logId: string) => void;
  onAddMergedVlogToAlbum: (communityId: string, dateKey: string, videoFile: File) => Promise<void> | void;
}) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [anchorDate, setAnchorDate] = useState(() => startOfLocalDay(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [activeVlogDateKey, setActiveVlogDateKey] = useState<string | null>(null);
  const calendarDays = useMemo(() => buildCalendarDays(anchorDate, viewMode), [anchorDate, viewMode]);
  const periodRange = useMemo(() => getCalendarPeriodRange(anchorDate, viewMode), [anchorDate, viewMode]);
  const eventsByDate = useMemo(() => groupEventsByDate(community.events), [community.events]);
  const visibleEvents = useMemo(
    () =>
      [...community.events]
        .filter((event) => isDateInRange(new Date(event.startsAt), periodRange.start, periodRange.end))
        .sort(sortEventsByStart),
    [community.events, periodRange]
  );
  const todayKey = toDateKey(new Date());
  const eventLimit = viewMode === "week" ? 3 : 1;
  const activeSelectedDateKey =
    selectedDateKey && isDateInRange(parseDateKey(selectedDateKey), periodRange.start, periodRange.end)
      ? selectedDateKey
      : null;
  const selectedDateEvents = activeSelectedDateKey ? eventsByDate.get(activeSelectedDateKey) ?? [] : [];
  const listedEvents = activeSelectedDateKey ? selectedDateEvents : visibleEvents;
  const listTitle = activeSelectedDateKey
    ? `${formatSelectedDate(parseDateKey(activeSelectedDateKey))} 일정`
    : viewMode === "week"
      ? "이 주 일정"
      : "이 달 일정";

  // 선택한 날짜에 해당하는 1초 영상들 필터링
  const selectedDateLogs = useMemo(() => {
    if (!activeSelectedDateKey) return [];
    return (community.oneSecondLogs || []).filter(
      (log) => toDateKey(new Date(log.createdAt)) === activeSelectedDateKey
    );
  }, [community.oneSecondLogs, activeSelectedDateKey]);

  // 이미 저장된 앨범 병합 비디오가 있는지 확인
  const hasSavedVlog = useMemo(() => {
    if (!activeSelectedDateKey) return false;
    const album = community.albums.find((a) => a.title === "데일리 Vlog");
    if (!album) return false;

    const formattedDate = new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric"
    }).format(new Date(activeSelectedDateKey));

    const targetTitle = `${formattedDate} Vlog`;
    return album.items.some((item) => item.title === targetTitle && item.kind === "video");
  }, [community.albums, activeSelectedDateKey]);

  const [ddayFilter, setDdayFilter] = useState<"all" | "기념일" | "여행" | "생일" | "행사">("all");

  const filteredDdays = useMemo(() => {
    if (ddayFilter === "all") return community.ddays;
    return community.ddays.filter((dday) => dday.kind === ddayFilter);
  }, [community.ddays, ddayFilter]);

  function moveCalendar(direction: -1 | 1) {
    setAnchorDate((current) =>
      viewMode === "month" ? addMonthsLocal(current, direction) : addDaysLocal(current, direction * 7)
    );
  }

  function selectToday() {
    const today = startOfLocalDay(new Date());
    setAnchorDate(today);
    setSelectedDateKey(toDateKey(today));
  }

  return (
    <>
      <section className="section">
        <SectionTitle
          title="캘린더"
          action={
            <div className="section-actions">
              <div className="segmented-control" role="group" aria-label="캘린더 보기 전환">
                <button
                  className={viewMode === "week" ? "is-active" : ""}
                  onClick={() => setViewMode("week")}
                >
                  1주
                </button>
                <button
                  className={viewMode === "month" ? "is-active" : ""}
                  onClick={() => setViewMode("month")}
                >
                  1달
                </button>
              </div>
              <button className="icon-button primary compact" onClick={() => onOpenEvent(activeSelectedDateKey ?? undefined)} aria-label="일정 추가" title="일정 추가">
                <Plus aria-hidden="true" />
              </button>
            </div>
          }
        />

        <div className="calendar-shell">
          <div className="calendar-toolbar">
            <button className="icon-button compact" onClick={() => moveCalendar(-1)} aria-label="이전 기간">
              <ChevronLeft aria-hidden="true" />
            </button>
            <strong className="calendar-toolbar-title">{formatCalendarTitle(calendarDays, viewMode)}</strong>
            <div className="calendar-nav-actions">
              <button className="secondary-button compact-button" onClick={selectToday}>
                오늘
              </button>
              <button className="icon-button compact" onClick={() => moveCalendar(1)} aria-label="다음 기간">
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="calendar-weekdays" aria-hidden="true">
            {weekdayLabels.map((label, index) => (
              <span key={label} className={index === 0 ? "is-sunday" : index === 6 ? "is-saturday" : ""}>
                {label}
              </span>
            ))}
          </div>

          <div className={`calendar-grid is-${viewMode}`}>
            {calendarDays.map((date) => {
              const dateKey = toDateKey(date);
              const isOutsideMonth = viewMode === "month" && date.getMonth() !== anchorDate.getMonth();
              if (isOutsideMonth) {
                return <div key={dateKey} className="calendar-day is-empty" aria-hidden="true" />;
              }

              const dayEvents = eventsByDate.get(dateKey) ?? [];
              const holiday = getKoreanHoliday(dateKey);
              const visibleDayEvents = dayEvents.slice(0, eventLimit);
              const hiddenCount = dayEvents.length - visibleDayEvents.length;
              return (
                <div
                  key={dateKey}
                  role="button"
                  tabIndex={0}
                  className={[
                    "calendar-day",
                    date.getDay() === 0 ? "is-sunday" : "",
                    date.getDay() === 6 ? "is-saturday" : "",
                    holiday ? "is-holiday" : "",
                    dayEvents.length ? "has-events" : "",
                    dateKey === activeSelectedDateKey ? "is-selected" : "",
                    dateKey === todayKey ? "is-today" : ""
                  ].filter(Boolean).join(" ")}
                  onClick={() => {
                    if (activeSelectedDateKey === dateKey) {
                      onOpenEvent(dateKey);
                    } else {
                      setSelectedDateKey(dateKey);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      if (activeSelectedDateKey === dateKey) {
                        onOpenEvent(dateKey);
                      } else {
                        setSelectedDateKey(dateKey);
                      }
                    }
                  }}
                >
                  <div className="calendar-day-head">
                    <span className="calendar-date-number">{date.getDate()}</span>
                    {dayEvents.length ? <small>{dayEvents.length}</small> : null}
                  </div>
                  {holiday ? (
                    <span className={`calendar-holiday-label is-${holiday.kind}`} title={holiday.name}>
                      {holiday.shortName}
                    </span>
                  ) : null}
                  <div className="calendar-day-events">
                    {visibleDayEvents.map((event) => (
                      <button
                        key={event.id}
                        className="calendar-event-chip"
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          if (canManageContent) onEditEvent(event.id);
                        }}
                        disabled={!canManageContent}
                        title={`${formatEventTime(event.startsAt)} ${event.title}`}
                      >
                        <span>{event.title}</span>
                      </button>
                    ))}
                    {hiddenCount > 0 ? <span className="calendar-more">+{hiddenCount}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 날짜가 선택되었고 해당 날짜의 1초 비디오 로그가 존재하는 경우 Vlog 바로 재생 버튼 노출 */}
        {activeSelectedDateKey && selectedDateLogs.length > 0 && (
          <div className="calendar-vlog-action" style={{ marginBottom: "14px" }}>
            <button
              className="primary-button inline-flex w-full"
              onClick={() => setActiveVlogDateKey(activeSelectedDateKey)}
              style={{ justifyContent: "center", gap: "6px" }}
            >
              <Video size={16} />
              이 날의 1s Vlog 감상하기 ({selectedDateLogs.length}개)
            </button>
          </div>
        )}

        <div className="calendar-list-head">
          <strong>{listTitle}</strong>
          <div className="calendar-list-actions">
            {activeSelectedDateKey ? (
              <button className="text-button compact-text-button" onClick={() => setSelectedDateKey(null)}>
                전체
              </button>
            ) : null}
            <span>{listedEvents.length}개</span>
          </div>
        </div>
        <div className="list">
          {listedEvents.length ? (
            listedEvents.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                community={community}
                onEdit={canManageContent ? () => onEditEvent(event.id) : undefined}
                onDelete={canManageContent ? () => onDeleteEvent(event.id) : undefined}
              />
            ))
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="이 기간 일정이 없습니다"
              body={
                community.events.length
                  ? "날짜나 보기 방식을 바꾸거나 새 일정을 추가하세요."
                  : "모임, 생일, 여행 등 함께 볼 일정을 추가하세요."
              }
            />
          )}
        </div>
      </section>

      {/* 캘린더 날짜 1s Vlog 플레이어 오버레이 */}
      {activeVlogDateKey && selectedDateLogs.length > 0 && (
        <OneSecondPlayerOverlay
          logs={selectedDateLogs}
          dateKey={activeVlogDateKey}
          dateLabel={`${formatSelectedDate(parseDateKey(activeVlogDateKey))}의`}
          currentUserId={currentUserId}
          onClose={() => setActiveVlogDateKey(null)}
          onDeleteLog={onDeleteOneSecondLog}
          hasSavedVlog={hasSavedVlog}
          onAddMergedVlogToAlbum={(dateKey, file) => onAddMergedVlogToAlbum(community.id, dateKey, file)}
          showMergeOption={true}
        />
      )}

      <section className="section">
        <SectionTitle
          title="D-Day"
          action={
            <button className="icon-button primary compact" onClick={onOpenDDay} aria-label="D-Day 추가" title="D-Day 추가">
              <Plus aria-hidden="true" />
            </button>
          }
        />
        <div className="filter-strip" role="group" aria-label="D-Day 필터">
          <FilterButton active={ddayFilter === "all"} label="전체" onClick={() => setDdayFilter("all")} />
          <FilterButton active={ddayFilter === "기념일"} label="기념일" onClick={() => setDdayFilter("기념일")} />
          <FilterButton active={ddayFilter === "여행"} label="여행" onClick={() => setDdayFilter("여행")} />
          <FilterButton active={ddayFilter === "생일"} label="생일" onClick={() => setDdayFilter("생일")} />
          <FilterButton active={ddayFilter === "행사"} label="행사" onClick={() => setDdayFilter("행사")} />
        </div>
        <div className="list">
          {filteredDdays.length ? (
            [...filteredDdays]
              .sort((a, b) => ddaySortValue(a) - ddaySortValue(b))
              .map((dday) => (
                <DDayRow
                  key={dday.id}
                  dday={dday}
                  community={community}
                  onEdit={canManageContent ? () => onEditDDay(dday.id) : undefined}
                  onDelete={canManageContent ? () => onDeleteDDay(dday.id) : undefined}
                />
              ))
          ) : (
            <EmptyState
              icon={Flag}
              title={ddayFilter === "all" ? "등록된 D-Day가 없습니다" : `${ddayFilter} 카테고리에 D-Day가 없습니다`}
              body="기념일, 여행일, 생일 같은 중요한 날짜를 함께 확인하세요."
            />
          )}
        </div>
      </section>
    </>
  );
}

type CalendarViewMode = "week" | "month";

const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

function buildCalendarDays(anchorDate: Date, viewMode: CalendarViewMode) {
  const range =
    viewMode === "week"
      ? getCalendarPeriodRange(anchorDate, viewMode)
      : {
          start: startOfWeek(new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)),
          end: endOfWeek(new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0))
        };
  const days: Date[] = [];
  for (let cursor = range.start; cursor.getTime() <= range.end.getTime(); cursor = addDaysLocal(cursor, 1)) {
    days.push(cursor);
  }
  return days;
}

function getCalendarPeriodRange(anchorDate: Date, viewMode: CalendarViewMode) {
  if (viewMode === "week") {
    const start = startOfWeek(anchorDate);
    return { start, end: endOfWeek(anchorDate) };
  }

  return {
    start: new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1),
    end: new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0)
  };
}

function groupEventsByDate(events: CalendarEvent[]) {
  return events.reduce((groups, event) => {
    const key = toDateKey(new Date(event.startsAt));
    const group = groups.get(key) ?? [];
    group.push(event);
    group.sort(sortEventsByStart);
    groups.set(key, group);
    return groups;
  }, new Map<string, CalendarEvent[]>());
}

function formatCalendarTitle(days: Date[], viewMode: CalendarViewMode) {
  if (viewMode === "month") {
    return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(days[14] ?? days[0]);
  }

  const first = days[0];
  const last = days[days.length - 1];
  return `${formatRangeDate(first)} - ${formatRangeDate(last)}`;
}

function formatRangeDate(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(date);
}

function formatSelectedDate(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(date);
}

function formatEventTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function isDateInRange(date: Date, start: Date, end: Date) {
  const target = startOfLocalDay(date).getTime();
  return target >= startOfLocalDay(start).getTime() && target <= startOfLocalDay(end).getTime();
}

function sortEventsByStart(a: CalendarEvent, b: CalendarEvent) {
  return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
}

function startOfWeek(date: Date) {
  const start = startOfLocalDay(date);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function endOfWeek(date: Date) {
  return addDaysLocal(startOfWeek(date), 6);
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDaysLocal(date: Date, days: number) {
  const next = startOfLocalDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonthsLocal(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function AlbumModule({
  community,
  selectedAlbumId,
  canManageContent,
  onOpenAlbum,
  onSelectAlbum,
  onOpenAlbumItem,
  onOpenAlbumItemDetail,
  onEditAlbum,
  onEditAlbumItem,
  onDeleteAlbum,
  onDeleteAlbumItem
}: {
  community: Community;
  selectedAlbumId: string | null;
  canManageContent: boolean;
  onOpenAlbum: () => void;
  onSelectAlbum: (albumId: string) => void;
  onOpenAlbumItem: (albumId: string) => void;
  onOpenAlbumItemDetail: (albumId: string, itemId: string) => void;
  onEditAlbum: (albumId: string) => void;
  onEditAlbumItem: (albumId: string, itemId: string) => void;
  onDeleteAlbum: (albumId: string) => void;
  onDeleteAlbumItem: (albumId: string, itemId: string) => void;
}) {
  const selectedAlbum = resolveSelectedAlbum(community.albums, selectedAlbumId);
  const photoItems = selectedAlbum?.items.filter((item) => item.mediaUrl) ?? [];
  const selectedCoverItem = selectedAlbum ? getAlbumCoverItem(selectedAlbum) : null;
  const selectedLatestItem = selectedAlbum ? getLatestAlbumItem(selectedAlbum) : null;

  return (
    <>
      <section className="section">
        <SectionTitle
          title="앨범"
          action={
            <button className="icon-button primary compact" onClick={onOpenAlbum} aria-label="앨범 만들기" title="앨범 만들기">
              <Plus aria-hidden="true" />
            </button>
          }
        />
        {selectedAlbum ? (
          <div className={`album-showcase ${selectedCoverItem?.mediaUrl ? "has-cover" : ""}`}>
            <div className="album-showcase-media">
              {selectedCoverItem?.mediaUrl ? (
                selectedCoverItem.kind === "video" ? (
                  <video src={selectedCoverItem.mediaUrl} muted playsInline loop autoPlay />
                ) : (
                  <img src={selectedCoverItem.mediaUrl} alt={selectedCoverItem.title} />
                )
              ) : (
                <Image aria-hidden="true" />
              )}
            </div>
            <div className="album-showcase-copy">
              <span>{community.name}</span>
              <strong>{selectedAlbum.title}</strong>
              <p>{selectedLatestItem?.title || selectedAlbum.description || "아직 대표 사진이 없습니다."}</p>
              <div className="album-showcase-stats">
                <span>{selectedAlbum.items.length}개 항목</span>
                <span>{photoItems.length}개 사진</span>
                <span>{selectedLatestItem ? formatContentDate(selectedLatestItem.createdAt) : formatContentDate(selectedAlbum.createdAt)}</span>
              </div>
            </div>
          </div>
        ) : null}
        <div className="album-grid">
          {community.albums.length ? (
            community.albums.map((album) => (
              <AlbumCard
                key={album.id}
                album={album}
                community={community}
                active={album.id === selectedAlbum?.id}
                onClick={() => onSelectAlbum(album.id)}
              />
            ))
          ) : (
            <EmptyState icon={Image} title="아직 앨범이 없습니다" body="모임과 여행별 사진·메모를 모아보세요." />
          )}
        </div>
      </section>

      {selectedAlbum ? (
        <section className="section">
          <SectionTitle
            title={selectedAlbum.title}
            action={
              <div className="section-actions">
                {canManageContent ? (
                  <>
                    <button className="icon-button compact" onClick={() => onEditAlbum(selectedAlbum.id)} aria-label="앨범 수정" title="앨범 수정">
                      <Pencil aria-hidden="true" />
                    </button>
                    <button className="icon-button compact danger-icon" onClick={() => onDeleteAlbum(selectedAlbum.id)} aria-label="앨범 삭제" title="앨범 삭제">
                      <Trash2 aria-hidden="true" />
                    </button>
                  </>
                ) : null}
                <button className="icon-button primary compact" onClick={() => onOpenAlbumItem(selectedAlbum.id)} aria-label="사진·메모 추가" title="사진·메모 추가">
                  <Plus aria-hidden="true" />
                </button>
              </div>
            }
          />
          {photoItems.length ? (
            <div className="photo-grid" aria-label="앨범 사진">
              {photoItems.map((item) => (
                <button
                  key={item.id}
                  className="photo-tile"
                  onClick={() => onOpenAlbumItemDetail(selectedAlbum.id, item.id)}
                  type="button"
                >
                  <img src={item.mediaUrl} alt={item.title} />
                  <span>{item.title}</span>
                </button>
              ))}
            </div>
          ) : null}
          <div className="list">
            {selectedAlbum.items.length ? (
              selectedAlbum.items.map((item) => (
                <AlbumItemRow
                  key={item.id}
                  item={item}
                  onClick={() => onOpenAlbumItemDetail(selectedAlbum.id, item.id)}
                  onEdit={canManageContent ? () => onEditAlbumItem(selectedAlbum.id, item.id) : undefined}
                  onDelete={canManageContent ? () => onDeleteAlbumItem(selectedAlbum.id, item.id) : undefined}
                />
              ))
            ) : (
              <EmptyState icon={Image} title="아직 사진이나 메모가 없습니다" body="이 앨범에 남길 사진이나 메모를 추가하세요." />
            )}
          </div>
        </section>
      ) : null}
    </>
  );
}

function DDayModule({
  community,
  canManageContent,
  onOpenDDay,
  onEditDDay,
  onDeleteDDay
}: {
  community: Community;
  canManageContent: boolean;
  onOpenDDay: () => void;
  onEditDDay: (ddayId: string) => void;
  onDeleteDDay: (ddayId: string) => void;
}) {
  const [filter, setFilter] = useState<"all" | "기념일" | "여행" | "생일" | "행사">("all");

  const filteredDdays = useMemo(() => {
    if (filter === "all") return community.ddays;
    return community.ddays.filter((dday) => dday.kind === filter);
  }, [community.ddays, filter]);

  return (
    <section className="section">
      <SectionTitle
        title="D-Day"
        action={
          <button className="icon-button primary compact" onClick={onOpenDDay} aria-label="D-Day 추가" title="D-Day 추가">
            <Plus aria-hidden="true" />
          </button>
        }
      />
      <div className="filter-strip" role="group" aria-label="D-Day 필터">
        <FilterButton active={filter === "all"} label="전체" onClick={() => setFilter("all")} />
        <FilterButton active={filter === "기념일"} label="기념일" onClick={() => setFilter("기념일")} />
        <FilterButton active={filter === "여행"} label="여행" onClick={() => setFilter("여행")} />
        <FilterButton active={filter === "생일"} label="생일" onClick={() => setFilter("생일")} />
        <FilterButton active={filter === "행사"} label="행사" onClick={() => setFilter("행사")} />
      </div>
      <div className="list">
        {filteredDdays.length ? (
          [...filteredDdays]
            .sort((a, b) => ddaySortValue(a) - ddaySortValue(b))
            .map((dday) => (
              <DDayRow
                key={dday.id}
                dday={dday}
                community={community}
                onEdit={canManageContent ? () => onEditDDay(dday.id) : undefined}
                onDelete={canManageContent ? () => onDeleteDDay(dday.id) : undefined}
              />
            ))
        ) : (
          <EmptyState
            icon={Flag}
            title={filter === "all" ? "등록된 D-Day가 없습니다" : `${filter} 카테고리에 D-Day가 없습니다`}
            body="기념일, 여행일, 생일 같은 중요한 날짜를 함께 확인하세요."
          />
        )}
      </div>
    </section>
  );
}

function MembersModule({
  community,
  currentUserId,
  onUpdateMemberRole,
  onRemoveMember,
  onRegenerateInviteCode,
  onCopyInviteCode,
  onModuleChange
}: {
  community: Community;
  currentUserId: string;
  onUpdateMemberRole: (memberId: string, role: Role) => void;
  onRemoveMember: (memberId: string) => void;
  onRegenerateInviteCode: () => void;
  onCopyInviteCode: () => void;
  onModuleChange: (module: CommunityModule) => void;
}) {
  const currentMember = community.members.find((member) => member.userId === currentUserId);
  const canManageMembers = currentMember?.role === "owner" || currentMember?.role === "admin";
  const ownerCount = community.members.filter((member) => member.role === "owner").length;
  const inviteUrl = createCommunityInviteUrl(community.inviteCode);
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=164x164&margin=8&data=${encodeURIComponent(inviteUrl)}`;

  return (
    <>
      <section className="section">
        <SectionTitle title="멤버" action={<span className="code-pill">{community.inviteCode}</span>} />
        <div className="invite-panel">
          <div className="invite-panel-copy">
            <strong>초대 링크</strong>
            <span>초대 링크나 QR을 받은 사람만 이 copula에 참여할 수 있습니다.</span>
          </div>
          <img className="invite-qr" src={qrImageUrl} alt={`${community.name} 초대 QR`} loading="lazy" />
          <div className="invite-actions">
            <button className="secondary-button invite-copy-button" onClick={onCopyInviteCode}>
              <Share2 aria-hidden="true" />
              링크 공유
            </button>
            {canManageMembers ? (
              <button className="icon-button compact" onClick={onRegenerateInviteCode} aria-label="코드 재생성" title="코드 재생성">
                <RefreshCw aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
        <div className="list">
          {community.members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              community={community}
              action={renderMemberAction({
                member,
                currentMember,
                canManageMembers,
                ownerCount,
                onUpdateMemberRole,
                onRemoveMember
              })}
            />
          ))}
        </div>
      </section>

      <section className="section">
        <SectionTitle title="관계" />
        <button className="module-button" onClick={() => onModuleChange("relationships")}>
          <Network aria-hidden="true" />
          <span className="module-button-copy">
            <strong>관계 관리로 이동</strong>
            {community.pairs.length}개 1:1 · {community.circles.length}개 그룹
          </span>
          <ChevronRight className="module-button-action" aria-hidden="true" />
        </button>
      </section>
    </>
  );
}

function renderMemberAction({
  member,
  currentMember,
  canManageMembers,
  ownerCount,
  onUpdateMemberRole,
  onRemoveMember
}: {
  member: Community["members"][number];
  currentMember: Community["members"][number] | undefined;
  canManageMembers: boolean;
  ownerCount: number;
  onUpdateMemberRole: (memberId: string, role: Role) => void;
  onRemoveMember: (memberId: string) => void;
}) {
  if (!currentMember) return null;

  const isSelf = member.id === currentMember.id;
  const isLastOwner = member.role === "owner" && ownerCount <= 1;
  const canEditRole =
    canManageMembers &&
    !isSelf &&
    (currentMember.role === "owner" || member.role !== "owner");
  const canRemove =
    isSelf || (
      canManageMembers &&
      !isSelf &&
      (currentMember.role === "owner" || member.role !== "owner")
    );

  if (!canEditRole && !canRemove) return null;

  const roleOptions: Role[] = currentMember.role === "owner"
    ? ["owner", "admin", "member"]
    : ["admin", "member"];

  return (
    <>
      {canEditRole ? (
        <select
          className="role-select"
          value={member.role}
          onChange={(event) => onUpdateMemberRole(member.id, event.currentTarget.value as Role)}
          aria-label={`${member.name} 역할 변경`}
        >
          {roleOptions.map((role) => (
            <option key={role} value={role}>
              {roleLabel(role)}
            </option>
          ))}
        </select>
      ) : null}
      {canRemove ? (
        <button
          className="row-icon-button danger"
          onClick={() => onRemoveMember(member.id)}
          disabled={isLastOwner}
          aria-label={isSelf ? "copula 나가기" : "멤버 내보내기"}
          title={isLastOwner ? "마지막 소유자는 나갈 수 없습니다" : isSelf ? "copula 나가기" : "멤버 내보내기"}
        >
          <UserMinus aria-hidden="true" />
        </button>
      ) : null}
    </>
  );
}

function resolveSelectedAlbum(albums: Album[], selectedAlbumId: string | null) {
  return (
    albums.find((album) => album.id === selectedAlbumId) ??
    albums.find((album) => album.items.some((item) => item.mediaUrl)) ??
    albums[0] ??
    null
  );
}

function createCommunityInviteUrl(inviteCode: string) {
  if (typeof window === "undefined") {
    return `/?invite=${encodeURIComponent(inviteCode)}`;
  }
  const url = new URL(window.location.origin);
  url.searchParams.set("invite", inviteCode);
  return url.toString();
}
