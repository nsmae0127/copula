import { useEffect, useMemo, useState } from "react";
import { demoUser, emptyState, seedState } from "./data";
import { getCopulaRepository } from "./repositories";
import type {
  Album,
  AlbumItemInput,
  AlbumItemUpdateInput,
  CalendarEvent,
  Circle,
  Community,
  CommunityModule,
  CommunityMessage,
  Commitment,
  CopulaNotification,
  CopulaState,
  DDayItem,
  JoinResult,
  Notice,
  NotificationKind,
  PushSubscriptionPayload,
  RelationshipPair,
  Role
} from "./types";
import { createId, initials, makeInviteCode, memberFromUser } from "./utils";

const accentColors = ["#F0717A", "#8C74BA", "#F6A8BE", "#FFD6C7", "#6FB7A5"];
const repository = getCopulaRepository();
const DAY_MS = 86_400_000;
const STORED_COMMUNITY_CONTENT_MODULES: CommunityModule[] = ["calendar", "commitments", "relationships", "albums", "1s"];

function createNotification(
  kind: NotificationKind,
  title: string,
  body: string,
  communityId?: string
): CopulaNotification {
  return {
    id: createId("notification"),
    kind,
    communityId,
    title,
    body,
    createdAt: new Date().toISOString(),
    read: false
  };
}

function withNotification(
  state: CopulaState,
  kind: NotificationKind,
  title: string,
  body: string,
  communityId?: string
): CopulaState {
  return {
    ...state,
    notifications: [createNotification(kind, title, body, communityId), ...state.notifications]
  };
}

function updateCommunity(
  state: CopulaState,
  communityId: string,
  update: (community: Community) => Community
): CopulaState {
  return {
    ...state,
    communities: state.communities.map((community) =>
      community.id === communityId ? update(community) : community
    )
  };
}

function sortNotices(notices: Notice[]) {
  return [...notices].sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function normalizeHandle(handle: string) {
  const trimmed = handle.trim();
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

function normalizeCommunity(community: Community): Community {
  const persisted = community as Community & {
    contentModules?: CommunityModule[];
    pairs?: RelationshipPair[];
    circles?: Circle[];
    commitments?: Commitment[];
    messages?: CommunityMessage[];
    events?: CalendarEvent[];
    albums?: Album[];
    ddays?: DDayItem[];
    notices?: Notice[];
    oneSecondLogs?: Community["oneSecondLogs"];
  };

  const rawCommitments = Array.isArray(persisted.commitments) ? persisted.commitments : [];
  const commitments = rawCommitments.map((commitment) => ({
    ...commitment,
    visibility: commitment.visibility || { type: "community" }
  }));

  return {
    ...community,
    contentModules: normalizeCommunityContentModules(persisted.contentModules),
    events: Array.isArray(persisted.events) ? persisted.events : [],
    albums: Array.isArray(persisted.albums) ? persisted.albums : [],
    ddays: Array.isArray(persisted.ddays) ? persisted.ddays : [],
    notices: Array.isArray(persisted.notices) ? persisted.notices : [],
    pairs: Array.isArray(persisted.pairs) ? persisted.pairs : [],
    circles: Array.isArray(persisted.circles) ? persisted.circles : [],
    commitments,
    messages: Array.isArray(persisted.messages) ? persisted.messages : [],
    oneSecondLogs: Array.isArray(persisted.oneSecondLogs) ? persisted.oneSecondLogs : []
  };
}

function normalizeCommunityContentModules(modules: unknown): CommunityModule[] {
  if (!Array.isArray(modules)) return [];
  const moduleSet = new Set(
    modules.filter((module): module is CommunityModule =>
      typeof module === "string" && STORED_COMMUNITY_CONTENT_MODULES.includes(module as CommunityModule)
    )
  );
  return STORED_COMMUNITY_CONTENT_MODULES.filter((module) => moduleSet.has(module));
}

function normalizeState(nextState: CopulaState, preferredSelectedCommunityId?: string | null): CopulaState {
  const communities = nextState.communities.map(normalizeCommunity);
  const preferredId = preferredSelectedCommunityId ?? null;
  const selectedCommunityId =
    preferredId && communities.some((community) => community.id === preferredId)
      ? preferredId
      : communities.some((community) => community.id === nextState.selectedCommunityId)
        ? nextState.selectedCommunityId
        : communities[0]?.id ?? null;

  return {
    ...nextState,
    selectedCommunityId,
    communities
  };
}

function withCommitmentReminders(nextState: CopulaState): CopulaState {
  if (!nextState.currentUser) {
    return nextState;
  }

  const existingIds = new Set(nextState.notifications.map((notification) => notification.id));
  const reminders: CopulaNotification[] = [];
  const today = startOfLocalDay(new Date()).getTime();

  nextState.communities.forEach((community) => {
    const currentMember = community.members.find((member) => member.userId === nextState.currentUser?.id);
    if (!currentMember) return;

    community.commitments.forEach((commitment) => {
      if (commitment.status !== "open" || !commitment.assigneeIds.includes(currentMember.id)) {
        return;
      }

      const due = startOfLocalDay(new Date(commitment.dueAt)).getTime();
      const days = Math.round((due - today) / DAY_MS);
      const reminderKey = days < 0 ? "overdue" : days === 0 ? "today" : days === 1 ? "tomorrow" : null;
      if (!reminderKey) return;

      const id = `notification-commitment-${community.id}-${commitment.id}-${reminderKey}`;
      if (existingIds.has(id)) return;

      reminders.push({
        id,
        kind: "commitment",
        communityId: community.id,
        title: reminderTitle(reminderKey),
        body: `${community.name} · ${commitment.title}`,
        createdAt: new Date().toISOString(),
        read: false
      });
    });
  });

  return reminders.length
    ? {
        ...nextState,
        notifications: [...reminders, ...nextState.notifications]
      }
    : nextState;
}

function reminderTitle(reminderKey: "overdue" | "today" | "tomorrow") {
  if (reminderKey === "overdue") return "기한이 지난 약속";
  if (reminderKey === "today") return "오늘 마감 약속";
  return "내일 마감 약속";
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isAdminRole(role: Role) {
  return role === "owner" || role === "admin";
}

function canToggleCommitmentForActor(
  community: Community,
  commitment: Commitment,
  actor: Community["members"][number] | undefined,
  currentUserId: string | undefined
) {
  return Boolean(
    actor &&
      (isAdminRole(actor.role) ||
        commitment.createdByUserId === currentUserId ||
        commitment.assigneeIds.includes(actor.id))
  );
}

function canDeleteCommitmentForActor(
  actor: Community["members"][number] | undefined,
  commitment: Commitment,
  currentUserId: string | undefined
) {
  return Boolean(actor && (isAdminRole(actor.role) || commitment.createdByUserId === currentUserId));
}

function queueCommunityNotification(
  communityId: string,
  kind: NotificationKind,
  title: string,
  body: string,
  tag: string
) {
  const task = repository.notifyCommunityMembers?.(communityId, kind, title, body, {
    excludeCurrentUser: true,
    url: kind === "message"
      ? `/?view=messages&community=${encodeURIComponent(communityId)}`
      : `/?view=community&community=${encodeURIComponent(communityId)}&module=${encodeURIComponent(kindToModule(kind))}`,
    tag
  });
  void task?.catch(() => undefined);
}

function kindToModule(kind: NotificationKind): CommunityModule {
  if (kind === "calendar" || kind === "dday") return "calendar";
  if (kind === "album") return "albums";
  if (kind === "commitment") return "commitments";
  if (kind === "message") return "messages";
  if (kind === "1s") return "1s";
  return "feed";
}

export function useCopulaStore() {
  const [state, setState] = useState<CopulaState>(() =>
    withCommitmentReminders(normalizeState(repository.getInitialState()))
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    repository
      .loadState()
      .then((nextState) => {
        if (!cancelled) {
          setState(withCommitmentReminders(normalizeState(nextState)));
          setLoadError(null);
          setIsHydrated(true);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "데이터를 불러오지 못했습니다.");
          setIsHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isHydrated) {
      void repository.saveState(state).catch((error) => {
        setLoadError(error instanceof Error ? error.message : "데이터를 저장하지 못했습니다.");
      });
    }
  }, [isHydrated, state]);

  useEffect(() => {
    if (!isHydrated) return;

    setState((previous) => {
      const next = withCommitmentReminders(previous);
      return next === previous ? previous : next;
    });
  }, [isHydrated, state.communities]);

  const selectedCommunity = useMemo(() => {
    if (!state.communities.length) return null;
    return (
      state.communities.find((community) => community.id === state.selectedCommunityId) ??
      state.communities[0]
    );
  }, [state.communities, state.selectedCommunityId]);

  useEffect(() => {
    if (!isHydrated || !selectedCommunity?.id || !repository.subscribeToCommunityMessages) {
      return;
    }

    let cancelled = false;
    const unsubscribe = repository.subscribeToCommunityMessages(selectedCommunity.id, () => {
      if (repository.loadCommunityMessages) {
        void repository
          .loadCommunityMessages(selectedCommunity.id)
          .then((messages) => {
            if (!cancelled) {
              setState((previous) =>
                updateCommunity(previous, selectedCommunity.id, (community) => ({
                  ...community,
                  messages: mergeMessages(community.messages, messages)
                }))
              );
              setLoadError(null);
            }
          })
          .catch((error) => {
            if (!cancelled) {
              setLoadError(error instanceof Error ? error.message : "메시지를 불러오지 못했습니다.");
            }
          });
        return;
      }

      void repository
        .loadState()
        .then((nextState) => {
          if (!cancelled) {
            setState((previous) =>
              withCommitmentReminders(normalizeState(nextState, previous.selectedCommunityId))
            );
            setLoadError(null);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setLoadError(error instanceof Error ? error.message : "메시지를 불러오지 못했습니다.");
          }
        });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isHydrated, selectedCommunity?.id]);

  async function signIn(...args: Parameters<NonNullable<typeof repository.signIn>>) {
    if (repository.signIn) {
      await repository.signIn(...args);
      const nextState = await repository.loadState();
      setLoadError(null);
      setState(withCommitmentReminders(normalizeState(nextState)));
      return;
    }

    setState(withCommitmentReminders(normalizeState(seedState())));
  }

  async function signOut() {
    if (repository.signOut) {
      await repository.signOut();
      setState(normalizeState(emptyState()));
      return;
    }

    setState((previous) => ({
      ...previous,
      currentUser: null,
      selectedCommunityId: null
    }));
  }

  async function resetDemo() {
    const nextState = await repository.resetState();
    setLoadError(null);
    setState(withCommitmentReminders(normalizeState(nextState)));
  }

  async function resetPassword(email: string) {
    if (!repository.resetPassword) {
      throw new Error("비밀번호 재설정은 이메일 로그인에서 사용할 수 있습니다.");
    }

    await repository.resetPassword(email);
  }

  async function updatePassword(password: string) {
    if (!repository.updatePassword) {
      throw new Error("비밀번호 변경은 이메일 로그인에서 사용할 수 있습니다.");
    }
    if (password.length < 6) {
      throw new Error("비밀번호는 6자 이상으로 입력해 주세요.");
    }

    await repository.updatePassword(password);
  }

  function selectCommunity(communityId: string) {
    setState((previous) => ({
      ...previous,
      selectedCommunityId: communityId
    }));
  }

  async function updateProfile(input: { name: string; handle: string }) {
    const name = input.name.trim();
    const handle = normalizeHandle(input.handle);

    if (!name || !handle) {
      throw new Error("이름과 사용자 아이디를 입력해 주세요.");
    }

    if (!/^@[A-Za-z0-9_]{2,30}$/.test(handle)) {
      throw new Error("사용자 아이디는 @로 시작하고 영문, 숫자, 밑줄 2-30자로 입력해 주세요.");
    }

    if (repository.updateProfile) {
      await repository.updateProfile({ name, handle });
    }

    setState((previous) => {
      if (!previous.currentUser) {
        return previous;
      }

      const nextUser = {
        ...previous.currentUser,
        name,
        handle,
        initials: initials(name)
      };

      return {
        ...previous,
        currentUser: nextUser,
        communities: previous.communities.map((community) => ({
          ...community,
          members: community.members.map((member) =>
            member.userId === nextUser.id
              ? {
                  ...member,
                  name: nextUser.name,
                  handle: nextUser.handle,
                  initials: nextUser.initials
                }
              : member
          )
        }))
      };
    });
  }

  async function joinCommunity(rawCode: string): Promise<JoinResult> {
    if (!state.currentUser) {
      return { status: "needsSignIn" };
    }

    const code = rawCode.trim().toUpperCase();

    if (repository.joinCommunityWithInviteCode) {
      const joined = await repository.joinCommunityWithInviteCode(code);
      if (!joined) {
        return { status: "invalidCode" };
      }

      const alreadyJoined = state.communities.some((community) => community.id === joined.id);
      setState((previous) => {
        if (alreadyJoined) {
          return {
            ...previous,
            selectedCommunityId: joined.id,
            communities: previous.communities.map((community) =>
              community.id === joined.id ? joined : community
            )
          };
        }

        return withNotification(
          {
            ...previous,
            selectedCommunityId: joined.id,
            communities: [joined, ...previous.communities]
          },
          "invite",
          `${joined.name} 참여`,
          "copula에 참여했습니다."
        );
      });

      if (!alreadyJoined) {
        queueCommunityNotification(
          joined.id,
          "invite",
          "새 멤버 참여",
          `${state.currentUser.name}님이 ${joined.name}에 참여했습니다.`,
          `join-${joined.id}`
        );
      }

      return {
        status: alreadyJoined ? "alreadyJoined" : "joined",
        communityName: joined.name
      };
    }

    const alreadyJoined = state.communities.find((community) => community.inviteCode === code);
    if (alreadyJoined) {
      setState((previous) => ({
        ...previous,
        selectedCommunityId: alreadyJoined.id
      }));
      return { status: "alreadyJoined", communityName: alreadyJoined.name };
    }

    const template = await repository.findCommunityByInviteCode(code);
    if (!template) {
      return { status: "invalidCode" };
    }

    const joined = template;
    joined.members = [...joined.members, memberFromUser(state.currentUser, "member")];
    setState((previous) =>
      withNotification(
        {
          ...previous,
          selectedCommunityId: joined.id,
          communities: [joined, ...previous.communities]
        },
        "invite",
        `${joined.name} 참여`,
        "copula에 참여했습니다."
      )
    );
    queueCommunityNotification(
      joined.id,
      "invite",
      "새 멤버 참여",
      `${state.currentUser.name}님이 ${joined.name}에 참여했습니다.`,
      `join-${joined.id}`
    );

    return { status: "joined", communityName: joined.name };
  }

  async function createCommunity(name: string, description: string) {
    if (repository.createCommunity) {
      const trimmedName = name.trim();
      const community = await repository.createCommunity({
        name: trimmedName,
        description: description.trim(),
        accent: accentColors[state.communities.length % accentColors.length]
      });

      setState((previous) =>
        withNotification(
          {
            ...previous,
            selectedCommunityId: community.id,
            communities: [
              community,
              ...previous.communities.filter((item) => item.id !== community.id)
            ]
          },
          "invite",
          `${community.name} 생성`,
          `초대 코드 ${community.inviteCode}를 사용할 수 있습니다.`
        )
      );
      return;
    }

    setState((previous) => {
      const currentUser = previous.currentUser ?? demoUser;
      const trimmedName = name.trim();
      const community: Community = {
        id: createId("community"),
        name: trimmedName,
        description: description.trim(),
        inviteCode: makeInviteCode(trimmedName),
        accent: accentColors[previous.communities.length % accentColors.length],
        coverUrl: null,
        createdAt: new Date().toISOString(),
        contentModules: [],
        members: [memberFromUser(currentUser, "owner")],
        events: [],
        albums: [],
        ddays: [],
        pairs: [],
        circles: [],
        commitments: [],
        messages: [],
        oneSecondLogs: [],
        notices: [
          {
            id: createId("notice"),
            title: "copula가 생성되었습니다",
            body: "초대 코드를 공유해서 멤버를 초대하세요.",
            createdAt: new Date().toISOString(),
            pinned: true
          }
        ]
      };

      return withNotification(
        {
          ...previous,
          selectedCommunityId: community.id,
          communities: [community, ...previous.communities]
        },
        "invite",
        `${community.name} 생성`,
        `초대 코드 ${community.inviteCode}를 사용할 수 있습니다.`
      );
    });
  }

  async function updateCommunityProfile(
    communityId: string,
    input: { name: string; description: string; accent: string; coverFile?: File; coverUrl?: string | null }
  ) {
    const community = state.communities.find((item) => item.id === communityId);
    const actor = community?.members.find((member) => member.userId === state.currentUser?.id);
    if (!community || !actor) {
      throw new Error("copula 정보를 찾지 못했습니다.");
    }
    if (actor.role !== "owner" && actor.role !== "admin") {
      throw new Error("copula를 수정할 권한이 없습니다.");
    }

    const updatedCommunity = repository.updateCommunity
      ? await repository.updateCommunity(communityId, input)
      : {
          ...community,
          ...input,
          coverUrl: input.coverUrl ?? null
        };

    setState((previous) => {
      const next = {
        ...previous,
        communities: previous.communities.map((item) =>
          item.id === communityId
            ? {
                ...item,
                name: updatedCommunity.name,
                description: updatedCommunity.description,
                accent: updatedCommunity.accent,
                coverUrl: updatedCommunity.coverUrl
              }
            : item
        )
      };

      return withNotification(
        next,
        "notice",
        "copula 수정",
        `${updatedCommunity.name} 정보가 수정되었습니다.`
      );
    });
  }

  async function regenerateInviteCode(communityId: string) {
    const community = state.communities.find((item) => item.id === communityId);
    const actor = community?.members.find((member) => member.userId === state.currentUser?.id);
    if (!community || !actor) {
      throw new Error("copula 정보를 찾지 못했습니다.");
    }
    if (actor.role !== "owner" && actor.role !== "admin") {
      throw new Error("초대 코드를 재생성할 권한이 없습니다.");
    }

    const nextInviteCode = repository.regenerateInviteCode
      ? await repository.regenerateInviteCode(communityId)
      : makeInviteCode(community.name);

    setState((previous) => {
      const next = updateCommunity(previous, communityId, (item) => ({
        ...item,
        inviteCode: nextInviteCode
      }));

      return withNotification(
        next,
        "invite",
        "초대 코드 재생성",
        `${community.name}의 새 초대 코드가 생성되었습니다.`
      );
    });

    return nextInviteCode;
  }

  async function addEvent(communityId: string, event: Omit<CalendarEvent, "id" | "createdAt">) {
    if (repository.addEvent) {
      const createdEvent = await repository.addEvent(communityId, event);
      setState((previous) => {
        const community = previous.communities.find((item) => item.id === communityId);
        const next = updateCommunity(previous, communityId, (item) => ({
          ...item,
          events: [...item.events, createdEvent].sort(
            (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
          )
        }));

        const actorName = previous.currentUser?.name ?? "멤버";
        return withNotification(
          next,
          "calendar",
          "새 일정",
          `${community?.name ?? "copula"} · ${actorName}님이 '${event.title}' 일정을 등록했습니다. 📅`
        );
      });
      const actorName = state.currentUser?.name ?? "멤버";
      const community = state.communities.find((item) => item.id === communityId);
      queueCommunityNotification(
        communityId,
        "calendar",
        "새 일정",
        `${community?.name ?? "copula"} · ${actorName}님이 '${event.title}' 일정을 등록했습니다. 📅`,
        `event-${communityId}-${createdEvent.id}`
      );
      return;
    }

    setState((previous) => {
      const community = previous.communities.find((item) => item.id === communityId);
      const next = updateCommunity(previous, communityId, (item) => ({
        ...item,
        events: [
          ...item.events,
          {
            ...event,
            id: createId("event"),
            createdAt: new Date().toISOString()
          }
        ].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      }));

      const actorName = previous.currentUser?.name ?? "멤버";
      return withNotification(
        next,
        "calendar",
        "새 일정",
        `${community?.name ?? "copula"} · ${actorName}님이 '${event.title}' 일정을 등록했습니다. 📅`
      );
    });
    const actorName = state.currentUser?.name ?? "멤버";
    const community = state.communities.find((item) => item.id === communityId);
    queueCommunityNotification(
      communityId,
      "calendar",
      "새 일정",
      `${community?.name ?? "copula"} · ${actorName}님이 '${event.title}' 일정을 등록했습니다. 📅`,
      `event-${communityId}`
    );
  }

  async function addAlbum(communityId: string, album: Omit<Album, "id" | "createdAt" | "items">) {
    if (repository.addAlbum) {
      const nextAlbum = await repository.addAlbum(communityId, album);
      setState((previous) => {
        const community = previous.communities.find((item) => item.id === communityId);
        const next = updateCommunity(previous, communityId, (item) => ({
          ...item,
          albums: [nextAlbum, ...item.albums]
        }));

        const actorName = previous.currentUser?.name ?? "멤버";
        return withNotification(
          next,
          "album",
          "새 앨범",
          `${community?.name ?? "copula"} · ${actorName}님이 '${album.title}' 앨범을 생성했습니다. 📸`
        );
      });
      const actorName = state.currentUser?.name ?? "멤버";
      const community = state.communities.find((item) => item.id === communityId);
      queueCommunityNotification(
        communityId,
        "album",
        "새 앨범",
        `${community?.name ?? "copula"} · ${actorName}님이 '${album.title}' 앨범을 생성했습니다. 📸`,
        `album-${communityId}-${nextAlbum.id}`
      );

      return nextAlbum.id;
    }

    const createdAlbumId = createId("album");

    setState((previous) => {
      const community = previous.communities.find((item) => item.id === communityId);
      const nextAlbum: Album = {
        ...album,
        id: createdAlbumId,
        createdAt: new Date().toISOString(),
        items: []
      };

      const next = updateCommunity(previous, communityId, (item) => ({
        ...item,
        albums: [nextAlbum, ...item.albums]
      }));

      const actorName = previous.currentUser?.name ?? "멤버";
      return withNotification(
        next,
        "album",
        "새 앨범",
        `${community?.name ?? "copula"} · ${actorName}님이 '${album.title}' 앨범을 생성했습니다. 📸`
      );
    });
    const actorName = state.currentUser?.name ?? "멤버";
    const community = state.communities.find((item) => item.id === communityId);
    queueCommunityNotification(
      communityId,
      "album",
      "새 앨범",
      `${community?.name ?? "copula"} · ${actorName}님이 '${album.title}' 앨범을 생성했습니다. 📸`,
      `album-${communityId}-${createdAlbumId}`
    );

    return createdAlbumId;
  }

  async function addAlbumItem(communityId: string, albumId: string, input: AlbumItemInput) {
    if (repository.addAlbumItem) {
      const item = await repository.addAlbumItem(communityId, albumId, input);
      setState((previous) => {
        const community = previous.communities.find((current) => current.id === communityId);
        const album = community?.albums.find((current) => current.id === albumId);
        const next = updateCommunity(previous, communityId, (currentCommunity) => ({
          ...currentCommunity,
          albums: currentCommunity.albums.map((currentAlbum) =>
            currentAlbum.id === albumId
              ? {
                  ...currentAlbum,
                  items: [item, ...currentAlbum.items]
                }
              : currentAlbum
          )
        }));

        const actorName = previous.currentUser?.name ?? "멤버";
        return withNotification(
          next,
          "album",
          "사진·메모 추가",
          `${community?.name ?? "copula"} · ${actorName}님이 '${album?.title ?? "앨범"}' 앨범에 '${input.title}'을(를) 추가했습니다. 📝`
        );
      });
      const actorName = state.currentUser?.name ?? "멤버";
      const community = state.communities.find((item) => item.id === communityId);
      const album = community?.albums.find((current) => current.id === albumId);
      queueCommunityNotification(
        communityId,
        "album",
        "사진·메모 추가",
        `${community?.name ?? "copula"} · ${actorName}님이 '${album?.title ?? "앨범"}' 앨범에 '${input.title}'을(를) 추가했습니다. 📝`,
        `album-item-${communityId}-${item.id}`
      );
      return;
    }

    setState((previous) => {
      const ownerName = previous.currentUser?.name ?? demoUser.name;
      const community = previous.communities.find((item) => item.id === communityId);
      const album = community?.albums.find((item) => item.id === albumId);
      const next = updateCommunity(previous, communityId, (item) => ({
        ...item,
        albums: item.albums.map((currentAlbum) =>
          currentAlbum.id === albumId
            ? {
                ...currentAlbum,
                items: [
                  {
                    id: createId("album-item"),
                    title: input.title,
                    kind: input.kind,
                    mediaUrl: input.mediaUrl,
                    ownerName,
                    createdAt: new Date().toISOString()
                  },
                  ...currentAlbum.items
                ]
              }
            : currentAlbum
        )
      }));

      const actorName = previous.currentUser?.name ?? "멤버";
      return withNotification(
        next,
        "album",
        "사진·메모 추가",
        `${community?.name ?? "copula"} · ${actorName}님이 '${album?.title ?? "앨범"}' 앨범에 '${input.title}'을(를) 추가했습니다. 📝`
      );
    });
    const actorName = state.currentUser?.name ?? "멤버";
    const community = state.communities.find((item) => item.id === communityId);
    const album = community?.albums.find((current) => current.id === albumId);
    queueCommunityNotification(
      communityId,
      "album",
      "사진·메모 추가",
      `${community?.name ?? "copula"} · ${actorName}님이 '${album?.title ?? "앨범"}' 앨범에 '${input.title}'을(를) 추가했습니다. 📝`,
      `album-item-${communityId}`
    );
  }

  async function addDDay(communityId: string, dday: Omit<DDayItem, "id">) {
    if (repository.addDDay) {
      const createdDDay = await repository.addDDay(communityId, dday);
      setState((previous) => {
        const community = previous.communities.find((item) => item.id === communityId);
        const next = updateCommunity(previous, communityId, (item) => ({
          ...item,
          ddays: [...item.ddays, createdDDay]
        }));

        const actorName = previous.currentUser?.name ?? "멤버";
        return withNotification(
          next,
          "dday",
          "새 D-Day",
          `${community?.name ?? "copula"} · ${actorName}님이 '${dday.title}' D-Day를 등록했습니다. 🎯`
        );
      });
      const actorName = state.currentUser?.name ?? "멤버";
      const community = state.communities.find((item) => item.id === communityId);
      queueCommunityNotification(
        communityId,
        "dday",
        "새 D-Day",
        `${community?.name ?? "copula"} · ${actorName}님이 '${dday.title}' D-Day를 등록했습니다. 🎯`,
        `dday-${communityId}-${createdDDay.id}`
      );
      return;
    }

    setState((previous) => {
      const community = previous.communities.find((item) => item.id === communityId);
      const next = updateCommunity(previous, communityId, (item) => ({
        ...item,
        ddays: [
          ...item.ddays,
          {
            ...dday,
            id: createId("dday")
          }
        ]
      }));

      const actorName = previous.currentUser?.name ?? "멤버";
      return withNotification(
        next,
        "dday",
        "새 D-Day",
        `${community?.name ?? "copula"} · ${actorName}님이 '${dday.title}' D-Day를 등록했습니다. 🎯`
      );
    });
    const actorName = state.currentUser?.name ?? "멤버";
    const community = state.communities.find((item) => item.id === communityId);
    queueCommunityNotification(
      communityId,
      "dday",
      "새 D-Day",
      `${community?.name ?? "copula"} · ${actorName}님이 '${dday.title}' D-Day를 등록했습니다. 🎯`,
      `dday-${communityId}`
    );
  }

  async function addNotice(communityId: string, notice: Omit<Notice, "id" | "createdAt">) {
    const createdNotice = repository.addNotice
      ? await repository.addNotice(communityId, notice)
      : {
          ...notice,
          id: createId("notice"),
          createdAt: new Date().toISOString()
        };

    setState((previous) => {
      const community = previous.communities.find((item) => item.id === communityId);
      const next = updateCommunity(previous, communityId, (item) => ({
        ...item,
        notices: sortNotices([createdNotice, ...item.notices])
      }));

      const actorName = previous.currentUser?.name ?? "멤버";
      return withNotification(
          next,
          "notice",
          "새 공지",
          `${community?.name ?? "copula"} · ${actorName}님이 '${notice.title}' 공지를 등록했습니다. 📢`
        );
    });
    const actorName = state.currentUser?.name ?? "멤버";
    const community = state.communities.find((item) => item.id === communityId);
    queueCommunityNotification(
      communityId,
      "notice",
      "새 공지",
      `${community?.name ?? "copula"} · ${actorName}님이 '${notice.title}' 공지를 등록했습니다. 📢`,
      `notice-${communityId}-${createdNotice.id}`
    );
  }

  async function refreshCommunityMessages(communityId: string, knownMessages: CommunityMessage[] = []) {
    if (!repository.loadCommunityMessages) {
      if (knownMessages.length) {
        setState((previous) =>
          updateCommunity(previous, communityId, (item) => ({
            ...item,
            messages: mergeMessages(item.messages, knownMessages)
          }))
        );
      }
      return;
    }

    try {
      const messages = await repository.loadCommunityMessages(communityId);
      setState((previous) =>
        updateCommunity(previous, communityId, (item) => ({
          ...item,
          messages: mergeMessages(item.messages, knownMessages, messages)
        }))
      );
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "메시지를 불러오지 못했습니다.");
    }
  }

  async function sendMessage(communityId: string, rawBody: string) {
    const body = rawBody.trim();
    if (!body) {
      throw new Error("메시지를 입력해 주세요.");
    }
    if (body.length > 2000) {
      throw new Error("메시지는 2000자 이하로 입력해 주세요.");
    }

    const community = state.communities.find((item) => item.id === communityId);
    const actor = community?.members.find((member) => member.userId === state.currentUser?.id);
    if (!community || !actor || !state.currentUser) {
      throw new Error("copula 멤버만 메시지를 보낼 수 있습니다.");
    }

    const createdMessage = repository.sendMessage
      ? await repository.sendMessage(communityId, body)
      : {
          id: createId("message"),
          communityId,
          senderUserId: state.currentUser.id,
          senderMemberId: actor.id,
          senderName: state.currentUser.name,
          senderInitials: state.currentUser.initials,
          body,
          createdAt: new Date().toISOString(),
          reactions: []
        };

    setState((previous) =>
      updateCommunity(previous, communityId, (item) => ({
        ...item,
        messages: upsertMessage(item.messages, createdMessage)
      }))
    );

    await refreshCommunityMessages(communityId, [createdMessage]);

    const preview = body.length > 80 ? `${body.slice(0, 80)}...` : body;
    queueCommunityNotification(
      communityId,
      "message",
      `${createdMessage.senderName}님의 새 메시지`,
      `${community.name} · ${preview}`,
      `message-${communityId}`
    );

    return createdMessage.id;
  }

  async function toggleMessageReaction(communityId: string, messageId: string, emoji: string) {
    const allowedEmojis = new Set(["❤️", "👍", "😂", "🎉"]);
    if (!allowedEmojis.has(emoji)) {
      throw new Error("지원하지 않는 반응입니다.");
    }
    if (!state.currentUser) {
      throw new Error("로그인이 필요합니다.");
    }

    const community = state.communities.find((item) => item.id === communityId);
    const message = community?.messages.find((item) => item.id === messageId);
    if (!community || !message) {
      throw new Error("메시지를 찾지 못했습니다.");
    }

    const updatedMessage = repository.toggleMessageReaction
      ? await repository.toggleMessageReaction(communityId, messageId, emoji)
      : toggleLocalMessageReaction(message, state.currentUser.id, emoji);

    setState((previous) =>
      updateCommunity(previous, communityId, (item) => ({
        ...item,
        messages: upsertMessage(item.messages, updatedMessage)
      }))
    );
  }

  async function addOneSecondLog(
    communityId: string,
    input: { file: File; caption: string }
  ) {
    if (!repository.addOneSecondLog) return;
    const createdLog = await repository.addOneSecondLog(communityId, input);

    setState((previous) => {
      const community = previous.communities.find((item) => item.id === communityId);
      const next = updateCommunity(previous, communityId, (item) => ({
        ...item,
        oneSecondLogs: [createdLog, ...item.oneSecondLogs]
      }));

      return withNotification(
        next,
        "1s",
        "새 1초 영상",
        `${community?.name ?? "copula"}에 ${createdLog.userName}님의 1초 영상이 등록되었습니다.`
      );
    });

    queueCommunityNotification(
      communityId,
      "1s",
      "새 1초 영상",
      `${createdLog.userName}님이 1초 영상을 등록했습니다.`,
      `1s-${communityId}-${createdLog.id}`
    );
  }

  async function deleteOneSecondLog(communityId: string, logId: string) {
    if (!repository.deleteOneSecondLog) return;
    await repository.deleteOneSecondLog(communityId, logId);

    setState((previous) => {
      const next = updateCommunity(previous, communityId, (item) => ({
        ...item,
        oneSecondLogs: item.oneSecondLogs.filter((log) => log.id !== logId)
      }));
      return next;
    });
  }

  async function addPair(
    communityId: string,
    pair: Omit<RelationshipPair, "id" | "createdAt">
  ) {
    const community = state.communities.find((item) => item.id === communityId);
    const actor = community?.members.find((member) => member.userId === state.currentUser?.id);
    if (!community || !actor) {
      throw new Error("copula 정보를 찾지 못했습니다.");
    }
    if (!isAdminRole(actor.role)) {
      throw new Error("1:1 관계는 소유자 또는 관리자만 만들 수 있습니다.");
    }

    const [firstMemberId, secondMemberId] = pair.memberIds;
    if (!firstMemberId || !secondMemberId || firstMemberId === secondMemberId) {
      throw new Error("서로 다른 두 멤버를 선택해 주세요.");
    }

    const createdPair = repository.addPair
      ? await repository.addPair(communityId, pair)
      : {
          ...pair,
          id: createId("pair"),
          createdAt: new Date().toISOString()
        };

    setState((previous) => {
      const community = previous.communities.find((item) => item.id === communityId);
      const next = updateCommunity(previous, communityId, (item) => ({
        ...item,
        pairs: [createdPair, ...item.pairs]
      }));

      return withNotification(
          next,
          "notice",
          "1:1 관계 추가",
          `${community?.name ?? "copula"}에 ${createdPair.label || "새 관계"}가 추가되었습니다.`
        );
    });
    queueCommunityNotification(
      communityId,
      "notice",
      "1:1 관계 추가",
      `${createdPair.label || "새 관계"} 관계가 만들어졌습니다.`,
      `pair-${communityId}-${createdPair.id}`
    );

    return createdPair.id;
  }

  async function addCircle(communityId: string, circle: Omit<Circle, "id" | "createdAt">) {
    const community = state.communities.find((item) => item.id === communityId);
    const actor = community?.members.find((member) => member.userId === state.currentUser?.id);
    if (!community || !actor) {
      throw new Error("copula 정보를 찾지 못했습니다.");
    }
    if (!isAdminRole(actor.role)) {
      throw new Error("그룹은 소유자 또는 관리자만 만들 수 있습니다.");
    }

    const memberIds = [...new Set(circle.memberIds)].filter(Boolean);
    const name = circle.name.trim();
    if (!name) {
      throw new Error("그룹 이름을 입력해 주세요.");
    }
    if (!memberIds.length) {
      throw new Error("그룹 멤버를 1명 이상 선택해 주세요.");
    }

    const createdCircle = repository.addCircle
      ? await repository.addCircle(communityId, { name, memberIds })
      : {
          id: createId("circle"),
          name,
          memberIds,
          createdAt: new Date().toISOString()
        };

    setState((previous) => {
      const community = previous.communities.find((item) => item.id === communityId);
      const next = updateCommunity(previous, communityId, (item) => ({
        ...item,
        circles: [createdCircle, ...item.circles]
      }));

      return withNotification(
          next,
          "notice",
          "1:N 그룹 추가",
          `${community?.name ?? "copula"}에 ${createdCircle.name} 그룹이 추가되었습니다.`
        );
    });
    queueCommunityNotification(
      communityId,
      "notice",
      "1:N 그룹 추가",
      `${createdCircle.name} 그룹이 만들어졌습니다.`,
      `circle-${communityId}-${createdCircle.id}`
    );

    return createdCircle.id;
  }

  async function addCommitment(
    communityId: string,
    commitment: Omit<Commitment, "id" | "createdAt" | "status" | "completedAt">
  ) {
    const title = commitment.title.trim();
    if (!title) {
      throw new Error("약속 제목을 입력해 주세요.");
    }
    const assigneeIds = [...new Set(commitment.assigneeIds)].filter(Boolean);
    if (!assigneeIds.length) {
      throw new Error("담당자를 1명 이상 선택해 주세요.");
    }

    const createdCommitment = repository.addCommitment
      ? await repository.addCommitment(communityId, {
          ...commitment,
          title,
          assigneeIds
        })
      : {
          ...commitment,
          id: createId("commitment"),
          title,
          status: "open" as const,
          assigneeIds,
          createdAt: new Date().toISOString(),
          createdByUserId: state.currentUser?.id
        };

    setState((previous) => {
      const community = previous.communities.find((item) => item.id === communityId);
      const next = updateCommunity(previous, communityId, (item) => ({
        ...item,
        commitments: [createdCommitment, ...item.commitments]
      }));

      return withNotification(
          next,
          "commitment",
          "약속 등록",
          `${community?.name ?? "copula"}에 ${createdCommitment.title} 약속이 등록되었습니다.`
        );
    });
    queueCommunityNotification(
      communityId,
      "commitment",
      "약속 등록",
      `${createdCommitment.title} 약속이 등록되었습니다.`,
      `commitment-${communityId}-${createdCommitment.id}`
    );

    return createdCommitment.id;
  }

  async function toggleCommitment(communityId: string, commitmentId: string) {
    const existing = state.communities
      .find((community) => community.id === communityId)
      ?.commitments.find((item) => item.id === commitmentId);
    const community = state.communities.find((item) => item.id === communityId);
    const actor = community?.members.find((member) => member.userId === state.currentUser?.id);
    if (!existing) {
      throw new Error("약속을 찾지 못했습니다.");
    }
    if (!community || !canToggleCommitmentForActor(community, existing, actor, state.currentUser?.id)) {
      throw new Error("이 약속의 완료 상태를 변경할 권한이 없습니다.");
    }

    const fallbackCommitment: Commitment = {
      ...existing,
      status: existing.status === "done" ? "open" as const : "done" as const,
      completedAt: existing.status === "done" ? undefined : new Date().toISOString()
    };
    let updatedCommitment = fallbackCommitment;
    if (repository.toggleCommitment) {
      try {
        updatedCommitment = await repository.toggleCommitment(communityId, commitmentId);
      } catch (error) {
        if (!(error instanceof Error && error.message === "약속을 찾지 못했습니다.")) {
          throw error;
        }
      }
    }

    setState((previous) => {
      const next = updateCommunity(previous, communityId, (item) => ({
        ...item,
        commitments: item.commitments.map((current) =>
          current.id === commitmentId ? updatedCommitment : current
        )
      }));

      const actorName = state.currentUser?.name ?? "멤버";
      return withNotification(
        next,
        "notice",
        updatedCommitment.status === "done" ? "약속 완수! 🎉" : "약속 다시 대기",
        updatedCommitment.status === "done"
          ? `내가 '${updatedCommitment.title}' 약속을 지켰습니다! 🤝`
          : `'${updatedCommitment.title}' 약속을 다시 열었습니다.`
      );
    });
    
    const actorName = state.currentUser?.name ?? "멤버";
    queueCommunityNotification(
      communityId,
      "notice",
      updatedCommitment.status === "done" ? "약속 완료! 🎉" : "약속 재개",
      updatedCommitment.status === "done"
        ? `${actorName}님이 '${updatedCommitment.title}' 약속을 지켰습니다! 🤝`
        : `${actorName}님이 '${updatedCommitment.title}' 약속을 다시 열었습니다.`,
      `commitment-status-${communityId}-${updatedCommitment.id}`
    );
  }

  async function deleteCommitment(communityId: string, commitmentId: string) {
    const community = state.communities.find((item) => item.id === communityId);
    const actor = community?.members.find((member) => member.userId === state.currentUser?.id);
    const existing = community?.commitments.find((item) => item.id === commitmentId);
    if (!community || !existing) {
      throw new Error("약속을 찾지 못했습니다.");
    }
    if (!canDeleteCommitmentForActor(actor, existing, state.currentUser?.id)) {
      throw new Error("이 약속을 삭제할 권한이 없습니다.");
    }

    if (repository.deleteCommitment) {
      await repository.deleteCommitment(communityId, commitmentId);
    }

    setState((previous) => {
      const community = previous.communities.find((item) => item.id === communityId);
      const commitment = community?.commitments.find((item) => item.id === commitmentId);
      const next = updateCommunity(previous, communityId, (item) => ({
        ...item,
        commitments: item.commitments.filter((current) => current.id !== commitmentId)
      }));

      return withNotification(
        next,
        "notice",
        "약속 삭제",
        `${commitment?.title ?? "약속"}이 삭제되었습니다.`
      );
    });
  }

  async function updateEvent(
    communityId: string,
    eventId: string,
    event: Omit<CalendarEvent, "id" | "createdAt">
  ) {
    const existing = state.communities
      .find((community) => community.id === communityId)
      ?.events.find((item) => item.id === eventId);
    const updatedEvent = repository.updateEvent
      ? await repository.updateEvent(communityId, eventId, event)
      : {
          ...event,
          id: eventId,
          createdAt: existing?.createdAt ?? new Date().toISOString()
        };

    setState((previous) => {
      const community = previous.communities.find((item) => item.id === communityId);
      const next = updateCommunity(previous, communityId, (item) => ({
        ...item,
        events: item.events
          .map((current) => (current.id === eventId ? updatedEvent : current))
          .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      }));

      return withNotification(
          next,
          "calendar",
          "일정 수정",
          `${community?.name ?? "copula"}의 ${event.title} 일정이 수정되었습니다.`
        );
    });
  }

  async function updateAlbum(
    communityId: string,
    albumId: string,
    album: Omit<Album, "id" | "createdAt" | "items">
  ) {
    const community = state.communities.find((item) => item.id === communityId);
    const existing = community?.albums.find((item) => item.id === albumId);
    if (!existing) {
      throw new Error("앨범을 찾지 못했습니다.");
    }

    const updatedAlbum = repository.updateAlbum
      ? {
          ...(await repository.updateAlbum(communityId, albumId, album)),
          items: existing.items
        }
      : {
          ...existing,
          ...album
        };

    setState((previous) => {
      const next = updateCommunity(previous, communityId, (item) => ({
        ...item,
        albums: item.albums.map((current) => (current.id === albumId ? updatedAlbum : current))
      }));

      return withNotification(
        next,
        "album",
        "앨범 수정",
        `${album.title} 앨범이 수정되었습니다.`
      );
    });
  }

  async function updateAlbumItem(
    communityId: string,
    albumId: string,
    itemId: string,
    input: AlbumItemUpdateInput
  ) {
    const community = state.communities.find((item) => item.id === communityId);
    const album = community?.albums.find((item) => item.id === albumId);
    const existing = album?.items.find((item) => item.id === itemId);
    if (!existing) {
      throw new Error("사진·메모를 찾지 못했습니다.");
    }

    const updatedItem = repository.updateAlbumItem
      ? await repository.updateAlbumItem(communityId, albumId, itemId, input)
      : {
          ...existing,
          title: input.title,
          kind: input.mediaUrl ? "photo" as const : existing.kind,
          mediaUrl: input.mediaUrl ?? existing.mediaUrl
        };

    setState((previous) => {
      const next = updateCommunity(previous, communityId, (item) => ({
        ...item,
        albums: item.albums.map((currentAlbum) =>
          currentAlbum.id === albumId
            ? {
                ...currentAlbum,
                items: currentAlbum.items.map((current) =>
                  current.id === itemId ? updatedItem : current
                )
              }
            : currentAlbum
        )
      }));

      return withNotification(
        next,
        "album",
        "사진·메모 수정",
        `${input.title}이 수정되었습니다.`
      );
    });
  }

  async function updateDDay(communityId: string, ddayId: string, dday: Omit<DDayItem, "id">) {
    const updatedDDay = repository.updateDDay
      ? await repository.updateDDay(communityId, ddayId, dday)
      : {
          ...dday,
          id: ddayId
        };

    setState((previous) => {
      const community = previous.communities.find((item) => item.id === communityId);
      const next = updateCommunity(previous, communityId, (item) => ({
        ...item,
        ddays: item.ddays.map((current) => (current.id === ddayId ? updatedDDay : current))
      }));

      return withNotification(
          next,
          "dday",
          "D-Day 수정",
          `${community?.name ?? "copula"}의 ${dday.title}이 수정되었습니다.`
        );
    });
  }

  async function updateNotice(
    communityId: string,
    noticeId: string,
    notice: Omit<Notice, "id" | "createdAt">
  ) {
    const existing = state.communities
      .find((community) => community.id === communityId)
      ?.notices.find((item) => item.id === noticeId);
    const updatedNotice = repository.updateNotice
      ? await repository.updateNotice(communityId, noticeId, notice)
      : {
          ...notice,
          id: noticeId,
          createdAt: existing?.createdAt ?? new Date().toISOString()
        };

    setState((previous) => {
      const community = previous.communities.find((item) => item.id === communityId);
      const next = updateCommunity(previous, communityId, (item) => ({
        ...item,
        notices: sortNotices(item.notices.map((current) => (current.id === noticeId ? updatedNotice : current)))
      }));

      return withNotification(
          next,
          "notice",
          "공지 수정",
          `${community?.name ?? "copula"}의 ${notice.title} 공지가 수정되었습니다.`
        );
    });
  }

  async function updateMemberRole(communityId: string, memberId: string, role: Role) {
    const community = state.communities.find((item) => item.id === communityId);
    const target = community?.members.find((item) => item.id === memberId);
    const actor = community?.members.find((item) => item.userId === state.currentUser?.id);
    if (!community || !target || !actor) {
      throw new Error("멤버 정보를 찾지 못했습니다.");
    }

    assertCanManageMemberRole(community, actor, target, role);
    const updatedMember = repository.updateMemberRole
      ? await repository.updateMemberRole(communityId, memberId, role)
      : {
          ...target,
          role
        };

    setState((previous) => {
      const next = updateCommunity(previous, communityId, (item) => ({
        ...item,
        members: item.members.map((member) =>
          member.id === memberId ? { ...member, role: updatedMember.role } : member
        )
      }));

      return withNotification(
        next,
        "notice",
        "역할 변경",
        `${target.name}님의 역할이 ${roleLabel(role)}로 변경되었습니다.`
      );
    });
  }

  async function removeMember(communityId: string, memberId: string) {
    const community = state.communities.find((item) => item.id === communityId);
    const target = community?.members.find((item) => item.id === memberId);
    const actor = community?.members.find((item) => item.userId === state.currentUser?.id);
    if (!community || !target || !actor) {
      throw new Error("멤버 정보를 찾지 못했습니다.");
    }

    assertCanRemoveMember(community, actor, target);
    if (repository.removeMember) {
      await repository.removeMember(communityId, memberId);
    }

    const isSelf = target.userId === state.currentUser?.id;
    setState((previous) => {
      if (isSelf) {
        const communities = previous.communities.filter((item) => item.id !== communityId);
        return withNotification(
          {
            ...previous,
            selectedCommunityId: communities[0]?.id ?? null,
            communities
          },
          "notice",
          "copula 나가기",
          `${community.name}에서 나갔습니다.`
        );
      }

      const next = updateCommunity(previous, communityId, (item) => {
        const members = item.members.filter((member) => member.id !== memberId);
        const pairs = item.pairs.filter((pair) => !pair.memberIds.includes(memberId));
        const circles = item.circles
          .map((circle) => ({
            ...circle,
            memberIds: circle.memberIds.filter((currentMemberId) => currentMemberId !== memberId)
          }))
          .filter((circle) => circle.memberIds.length > 0);
        const pairIds = new Set(pairs.map((pair) => pair.id));
        const circleIds = new Set(circles.map((circle) => circle.id));

        return {
          ...item,
          members,
          pairs,
          circles,
          commitments: item.commitments.map((commitment) => ({
            ...commitment,
            assigneeIds: commitment.assigneeIds.filter((currentMemberId) => currentMemberId !== memberId),
            visibility:
              commitment.visibility && commitment.visibility.type === "pair" && !pairIds.has(commitment.visibility.pairId)
                ? { type: "community" }
                : commitment.visibility && commitment.visibility.type === "circle" && !circleIds.has(commitment.visibility.circleId)
                  ? { type: "community" }
                  : commitment.visibility || { type: "community" }
          }))
        };
      });

      return withNotification(
        next,
        "notice",
        "멤버 내보내기",
        `${target.name}님을 copula에서 내보냈습니다.`
      );
    });
  }

  async function deleteEvent(communityId: string, eventId: string) {
    if (repository.deleteEvent) {
      await repository.deleteEvent(communityId, eventId);
    }

    setState((previous) => {
      const community = previous.communities.find((item) => item.id === communityId);
      const event = community?.events.find((item) => item.id === eventId);
      const next = updateCommunity(previous, communityId, (item) => ({
        ...item,
        events: item.events.filter((current) => current.id !== eventId)
      }));

      return withNotification(
        next,
        "calendar",
        "일정 삭제",
        `${event?.title ?? "일정"}이 삭제되었습니다.`
      );
    });
  }

  async function deleteAlbum(communityId: string, albumId: string) {
    if (repository.deleteAlbum) {
      await repository.deleteAlbum(communityId, albumId);
    }

    setState((previous) => {
      const community = previous.communities.find((item) => item.id === communityId);
      const album = community?.albums.find((item) => item.id === albumId);
      const next = updateCommunity(previous, communityId, (item) => ({
        ...item,
        albums: item.albums.filter((current) => current.id !== albumId)
      }));

      return withNotification(
        next,
        "album",
        "앨범 삭제",
        `${album?.title ?? "앨범"}이 삭제되었습니다.`
      );
    });
  }

  async function deleteAlbumItem(communityId: string, albumId: string, itemId: string) {
    if (repository.deleteAlbumItem) {
      await repository.deleteAlbumItem(communityId, albumId, itemId);
    }

    setState((previous) => {
      const community = previous.communities.find((item) => item.id === communityId);
      const album = community?.albums.find((item) => item.id === albumId);
      const albumItem = album?.items.find((item) => item.id === itemId);
      const next = updateCommunity(previous, communityId, (item) => ({
        ...item,
        albums: item.albums.map((currentAlbum) =>
          currentAlbum.id === albumId
            ? {
                ...currentAlbum,
                items: currentAlbum.items.filter((current) => current.id !== itemId)
              }
            : currentAlbum
        )
      }));

      return withNotification(
        next,
        "album",
        "사진·메모 삭제",
        `${albumItem?.title ?? album?.title ?? "사진·메모"}가 삭제되었습니다.`
      );
    });
  }

  async function deleteDDay(communityId: string, ddayId: string) {
    if (repository.deleteDDay) {
      await repository.deleteDDay(communityId, ddayId);
    }

    setState((previous) => {
      const community = previous.communities.find((item) => item.id === communityId);
      const dday = community?.ddays.find((item) => item.id === ddayId);
      const next = updateCommunity(previous, communityId, (item) => ({
        ...item,
        ddays: item.ddays.filter((current) => current.id !== ddayId)
      }));

      return withNotification(
        next,
        "dday",
        "D-Day 삭제",
        `${dday?.title ?? "D-Day"}가 삭제되었습니다.`
      );
    });
  }

  async function deleteNotice(communityId: string, noticeId: string) {
    if (repository.deleteNotice) {
      await repository.deleteNotice(communityId, noticeId);
    }

    setState((previous) => {
      const community = previous.communities.find((item) => item.id === communityId);
      const notice = community?.notices.find((item) => item.id === noticeId);
      const next = updateCommunity(previous, communityId, (item) => ({
        ...item,
        notices: item.notices.filter((current) => current.id !== noticeId)
      }));

      return withNotification(
        next,
        "notice",
        "공지 삭제",
        `${notice?.title ?? "공지"}가 삭제되었습니다.`
      );
    });
  }

  async function deleteCommunity(communityId: string) {
    const community = state.communities.find((item) => item.id === communityId);
    const actor = community?.members.find((member) => member.userId === state.currentUser?.id);
    if (!community || !actor) {
      throw new Error("copula 정보를 찾지 못했습니다.");
    }
    if (actor.role !== "owner") {
      throw new Error("copula는 소유자만 삭제할 수 있습니다.");
    }

    if (repository.deleteCommunity) {
      await repository.deleteCommunity(communityId);
    }

    setState((previous) => {
      const communities = previous.communities.filter((item) => item.id !== communityId);
      return withNotification(
        {
          ...previous,
          selectedCommunityId:
            previous.selectedCommunityId === communityId
              ? communities[0]?.id ?? null
              : previous.selectedCommunityId,
          communities
        },
        "notice",
        "copula 삭제",
        `${community.name} copula가 삭제되었습니다.`
      );
    });
  }

  function markNotificationsRead() {
    setState((previous) => ({
      ...previous,
      notifications: previous.notifications.map((item) => ({ ...item, read: true }))
    }));
    void repository.markNotificationsRead?.().catch(() => undefined);
  }

  function markNotificationRead(notificationId: string) {
    setState((previous) => ({
      ...previous,
      notifications: previous.notifications.map((item) =>
        item.id === notificationId ? { ...item, read: true } : item
      )
    }));
    void repository.markNotificationRead?.(notificationId).catch(() => undefined);
  }

  function notify(kind: NotificationKind, title: string, body: string, communityId?: string) {
    const optimistic = createNotification(kind, title, body, communityId);
    setState((previous) => ({
      ...previous,
      notifications: [optimistic, ...previous.notifications]
    }));
    void repository.createNotification?.(kind, title, body, communityId)
      .then((saved) => {
        setState((previous) => ({
          ...previous,
          notifications: previous.notifications.map((item) =>
            item.id === optimistic.id ? saved : item
          )
        }));
      })
      .catch(() => undefined);
  }

  async function savePushSubscription(subscription: PushSubscriptionPayload) {
    await repository.savePushSubscription?.(subscription);
  }

  async function setCommunityContentModules(communityId: string, modules: CommunityModule[]) {
    const normalizedModules = normalizeCommunityContentModules(modules);
    const savedModules = repository.setCommunityContentModules
      ? await repository.setCommunityContentModules(communityId, normalizedModules)
      : normalizedModules;
    const nextModules = normalizeCommunityContentModules(savedModules);

    setState((previous) =>
      updateCommunity(previous, communityId, (community) => ({
        ...community,
        contentModules: nextModules
      }))
    );
  }

  return {
    state,
    selectedCommunity,
    status: {
      backend: repository.backend,
      isHydrated,
      loadError
    },
    actions: {
      signIn,
      signOut,
      resetDemo,
      resetPassword,
      updatePassword,
      updateProfile,
      selectCommunity,
      joinCommunity,
      createCommunity,
      updateCommunityProfile,
      setCommunityContentModules,
      regenerateInviteCode,
      addNotice,
      addEvent,
      addAlbum,
      addAlbumItem,
      addDDay,
      addPair,
      addCircle,
      addCommitment,
      updateEvent,
      updateAlbum,
      updateAlbumItem,
      updateDDay,
      updateNotice,
      updateMemberRole,
      deleteEvent,
      deleteAlbum,
      deleteAlbumItem,
      deleteDDay,
      deleteNotice,
      toggleCommitment,
      deleteCommitment,
      deleteCommunity,
      removeMember,
      markNotificationRead,
      markNotificationsRead,
      notify,
      savePushSubscription,
      sendMessage,
      toggleMessageReaction,
      addOneSecondLog,
      deleteOneSecondLog
    }
  };
}

function upsertMessage(messages: CommunityMessage[], nextMessage: CommunityMessage) {
  return mergeMessages(messages, [nextMessage]);
}

function mergeMessages(...messageGroups: Array<CommunityMessage[]>) {
  const byId = new Map<string, CommunityMessage>();
  messageGroups.flat().forEach((message) => {
    byId.set(message.id, {
      ...byId.get(message.id),
      ...message,
      reactions: message.reactions ?? byId.get(message.id)?.reactions ?? []
    });
  });

  return [...byId.values()].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function toggleLocalMessageReaction(message: CommunityMessage, userId: string, emoji: string): CommunityMessage {
  const existing = message.reactions.find((reaction) => reaction.userId === userId && reaction.emoji === emoji);
  if (existing) {
    return {
      ...message,
      reactions: message.reactions.filter((reaction) => reaction.id !== existing.id)
    };
  }

  return {
    ...message,
    reactions: [
      ...message.reactions,
      {
        id: createId("reaction"),
        messageId: message.id,
        userId,
        emoji,
        createdAt: new Date().toISOString()
      }
    ]
  };
}

function ownerCount(community: Community) {
  return community.members.filter((member) => member.role === "owner").length;
}

function assertCanManageMemberRole(
  community: Community,
  actor: Community["members"][number],
  target: Community["members"][number],
  nextRole: Role
) {
  if (actor.role !== "owner" && actor.role !== "admin") {
    throw new Error("멤버 역할을 변경할 권한이 없습니다.");
  }
  if (actor.role !== "owner" && (target.role === "owner" || nextRole === "owner")) {
    throw new Error("소유자 역할은 소유자만 변경할 수 있습니다.");
  }
  if (target.role === "owner" && nextRole !== "owner" && ownerCount(community) <= 1) {
    throw new Error("마지막 소유자의 역할은 변경할 수 없습니다.");
  }
}

function assertCanRemoveMember(
  community: Community,
  actor: Community["members"][number],
  target: Community["members"][number]
) {
  const isSelf = actor.id === target.id;
  if (!isSelf && actor.role !== "owner" && actor.role !== "admin") {
    throw new Error("멤버를 내보낼 권한이 없습니다.");
  }
  if (actor.role !== "owner" && target.role === "owner") {
    throw new Error("소유자는 소유자만 내보낼 수 있습니다.");
  }
  if (target.role === "owner" && ownerCount(community) <= 1) {
    throw new Error("마지막 소유자는 copula를 나갈 수 없습니다.");
  }
}

function roleLabel(role: Role) {
  if (role === "owner") return "소유자";
  if (role === "admin") return "관리자";
  return "멤버";
}
