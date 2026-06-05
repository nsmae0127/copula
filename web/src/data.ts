import type { Community, CopulaNotification, CopulaState, UserProfile } from "./types";
import { addDays, addHours, memberFromUser } from "./utils";

export const demoUser: UserProfile = {
  id: "user-leemae",
  name: "Lee Mae",
  handle: "@leemae",
  initials: "LM"
};

export function emptyState(currentUser: UserProfile | null = null): CopulaState {
  return {
    currentUser,
    selectedCommunityId: null,
    communities: [],
    notifications: []
  };
}

const demoNotifications: CopulaNotification[] = [
  {
    id: "notification-event",
    kind: "calendar",
    title: "다가오는 일정",
    body: "성수 저녁 모임이 2일 남았습니다.",
    createdAt: addHours(-1),
    read: false
  },
  {
    id: "notification-album",
    kind: "album",
    title: "새 추억",
    body: "봄 피크닉 앨범에 사진이 추가되었습니다.",
    createdAt: addHours(-5),
    read: false
  }
];

export function seedState(): CopulaState {
  const weekendMembers = [
    memberFromUser(demoUser, "owner", addDays(-40)),
    memberFromUser({ id: "user-jin", name: "Jin", handle: "@jin", initials: "JN" }, "admin", addDays(-31)),
    memberFromUser({ id: "user-ara", name: "Ara", handle: "@ara", initials: "AR" }, "member", addDays(-16))
  ];
  const planningPairId = "pair-weekend-planning";
  const tripCircleId = "circle-weekend-trip";

  const weekend: Community = {
    id: "community-weekend",
    name: "Weekend Circle",
    description: "친구들과 일정, 사진, 기념일을 모아두는 공간",
    inviteCode: "WEEK26",
    accent: "#f0717a",
    coverUrl: null,
    createdAt: addDays(-40),
    members: weekendMembers,
    events: [
      {
        id: "event-dinner",
        title: "성수 저녁 모임",
        notes: "예약 확인 필요",
        location: "성수동",
        startsAt: addDays(2, 19),
        createdAt: addDays(-4)
      },
      {
        id: "event-birthday",
        title: "5월 생일 파티",
        notes: "케이크 담당 정하기",
        location: "합정",
        startsAt: addDays(10, 18),
        createdAt: addDays(-3)
      }
    ],
    albums: [
      {
        id: "album-picnic",
        title: "봄 피크닉",
        description: "한강에서 찍은 사진",
        createdAt: addDays(-12),
        items: [
          { id: "item-picnic-1", title: "돗자리 세팅", kind: "note", ownerName: "Lee Mae", createdAt: addDays(-12) },
          { id: "item-picnic-2", title: "단체 사진", kind: "note", ownerName: "Ara", createdAt: addDays(-12) }
        ]
      }
    ],
    ddays: [
      {
        id: "dday-jeju",
        title: "제주 여행",
        targetDate: addDays(37),
        kind: "여행",
        note: "항공권 예매 완료"
      },
      {
        id: "dday-100",
        title: "copula 100일",
        targetDate: addDays(18),
        kind: "기념일",
        note: "작은 이벤트 준비"
      }
    ],
    notices: [
      {
        id: "notice-privacy",
        title: "초대 코드는 외부 공유 금지",
        body: "copula 초대는 멤버가 아는 사람에게만 공유해 주세요.",
        createdAt: addDays(-7),
        pinned: true
      }
    ],
    pairs: [
      {
        id: planningPairId,
        memberIds: [weekendMembers[0].id, weekendMembers[1].id],
        label: "이번 주 모임 준비",
        createdAt: addDays(-5)
      }
    ],
    circles: [
      {
        id: tripCircleId,
        name: "제주 준비팀",
        memberIds: [weekendMembers[0].id, weekendMembers[2].id],
        createdAt: addDays(-4)
      }
    ],
    commitments: [
      {
        id: "commitment-weekend-cake",
        title: "생일 케이크 후보 3개 공유",
        note: "가격대와 픽업 가능 시간을 같이 적기",
        dueAt: addDays(3, 18),
        status: "open",
        assigneeIds: [weekendMembers[1].id],
        visibility: { type: "pair", pairId: planningPairId },
        createdAt: addDays(-2),
        createdByUserId: demoUser.id
      },
      {
        id: "commitment-weekend-jeju",
        title: "제주 숙소 체크인 규칙 확인",
        note: "인원 추가 비용이 있는지 확인",
        dueAt: addDays(7, 12),
        status: "open",
        assigneeIds: [weekendMembers[0].id, weekendMembers[2].id],
        visibility: { type: "circle", circleId: tripCircleId },
        createdAt: addDays(-1),
        createdByUserId: demoUser.id
      }
    ],
    messages: [
      {
        id: "message-weekend-hello",
        communityId: "community-weekend",
        senderUserId: "user-jin",
        senderMemberId: weekendMembers[1].id,
        senderName: "Jin",
        senderInitials: "JN",
        body: "이번 주 모임 장소 여기서 같이 정해보자.",
        createdAt: addHours(-3),
        reactions: [
          {
            id: "reaction-weekend-hello-heart",
            messageId: "message-weekend-hello",
            userId: demoUser.id,
            emoji: "❤️",
            createdAt: addHours(-2)
          }
        ]
      },
      {
        id: "message-weekend-reply",
        communityId: "community-weekend",
        senderUserId: demoUser.id,
        senderMemberId: weekendMembers[0].id,
        senderName: demoUser.name,
        senderInitials: demoUser.initials,
        body: "좋아! 성수 쪽 후보 몇 개 찾아볼게.",
        createdAt: addHours(-2),
        reactions: []
      }
    ],
    oneSecondLogs: []
  };

  return {
    currentUser: demoUser,
    selectedCommunityId: weekend.id,
    communities: [weekend],
    notifications: demoNotifications
  };
}

export function inviteCatalog(): Record<string, Community> {
  return {
    FAMILY12: {
      id: "community-family",
      name: "Family Room",
      description: "가족 일정과 기념일을 함께 관리하는 공간",
      inviteCode: "FAMILY12",
      accent: "#f6a8be",
      coverUrl: null,
      createdAt: addDays(-120),
      members: [
        memberFromUser({ id: "user-mom", name: "Mom", handle: "@mom", initials: "MO" }, "owner", addDays(-120))
      ],
      events: [
        {
          id: "event-family-dinner",
          title: "가족 식사",
          notes: "예약 시간 확인",
          location: "광화문",
          startsAt: addDays(5, 18),
          createdAt: addDays(-2)
        }
      ],
      albums: [],
      ddays: [
        {
          id: "dday-father",
          title: "아버지 생신",
          targetDate: addDays(24),
          kind: "생일",
          note: "선물 준비"
        }
      ],
      notices: [],
      pairs: [],
      circles: [],
      commitments: [],
      messages: [],
      oneSecondLogs: []
    },
    TRAVEL26: {
      id: "community-osaka",
      name: "Osaka Trip",
      description: "여행 준비, 일정, 사진을 모으는 공간",
      inviteCode: "TRAVEL26",
      accent: "#8c74ba",
      coverUrl: null,
      createdAt: addDays(-15),
      members: [],
      events: [
        {
          id: "event-kix",
          title: "간사이 공항 도착",
          notes: "숙소 체크인 전 짐 보관",
          location: "KIX",
          startsAt: addDays(42, 13),
          createdAt: addDays(-1)
        }
      ],
      albums: [],
      ddays: [
        {
          id: "dday-osaka",
          title: "오사카 출발",
          targetDate: addDays(42),
          kind: "여행",
          note: "여권 확인"
        }
      ],
      notices: [],
      pairs: [],
      circles: [],
      commitments: [],
      messages: [],
      oneSecondLogs: []
    },
    CREW999: {
      id: "community-crew",
      name: "Studio Crew",
      description: "프로젝트 멤버만 접근하는 작업 copula",
      inviteCode: "CREW999",
      accent: "#8c74ba",
      coverUrl: null,
      createdAt: addDays(-8),
      members: [],
      events: [],
      albums: [],
      ddays: [
        {
          id: "dday-launch-review",
          title: "런칭 리뷰",
          targetDate: addDays(14),
          kind: "행사",
          note: "시안 정리"
        }
      ],
      notices: [
        {
          id: "notice-final-assets",
          title: "자료 업로드 규칙",
          body: "앨범에는 최종본만 올려 주세요.",
          createdAt: addDays(-2),
          pinned: true
        }
      ],
      pairs: [],
      circles: [],
      commitments: [],
      messages: [],
      oneSecondLogs: []
    }
  };
}
