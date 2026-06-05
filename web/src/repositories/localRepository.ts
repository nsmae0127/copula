import { inviteCatalog, seedState } from "../data";
import type { Community, CopulaState } from "../types";
import { clone } from "../utils";
import type { CopulaRepository } from "./repository";

const STORAGE_KEY = "copula.react.state.v1";

export function createLocalRepository(): CopulaRepository {
  function readState(): CopulaState {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return seedState();
    }

    try {
      return JSON.parse(saved) as CopulaState;
    } catch {
      return seedState();
    }
  }

  return {
    backend: "local",

    getInitialState() {
      return readState();
    },

    async loadState() {
      return readState();
    },

    async saveState(state) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },

    async resetState() {
      const next = seedState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    },

    async findCommunityByInviteCode(inviteCode: string): Promise<Community | null> {
      const community = inviteCatalog()[inviteCode.trim().toUpperCase()];
      return community ? clone(community) : null;
    },

    async savePushSubscription() {
      return undefined;
    },

    async notifyCommunityMembers() {
      return undefined;
    },

    async addOneSecondLog(communityId, input) {
      const user = readState().currentUser;
      const userName = user?.name ?? "멤버";

      return {
        id: `1s-${Math.random().toString(36).substring(2, 9)}`,
        communityId,
        userId: user?.id ?? "local-user",
        userName,
        userInitials: user?.initials ?? "M",
        videoUrl: URL.createObjectURL(input.file),
        caption: input.caption,
        createdAt: new Date().toISOString()
      };
    },

    async deleteOneSecondLog() {
      return undefined;
    }
  };
}
