import type { PendingKickRecord } from "./services/kick-queue-service";
import KickQueueService from "./services/kick-queue-service";

interface CheckAllResult {
  addedCount: number;
  alreadyPendingCount: number;
  failedCount: number;
}

export interface KickQueuedUsersResult {
  kickedCount: number;
  notFoundCount: number;
  failedCount: number;
}

type EnqueueCheckMessageJob = (
  guildId: string,
  userId: string,
) => Promise<void>;

type KickUserById = (
  userId: string,
) => Promise<"kicked" | "not-found" | "failed">;

export default class MembersProcessor {
  constructor(private readonly service: KickQueueService) {}

  async listPendingKickUsers(
    guildId: string,
    limit?: number,
  ): Promise<PendingKickRecord[]> {
    return this.service.listPendingKickUsers(guildId, limit);
  }

  async addPendingKickUser(guildId: string, userId: string): Promise<boolean> {
    return this.service.addPendingKickUser(guildId, userId);
  }

  async removePendingKickUser(
    guildId: string,
    userId: string,
  ): Promise<boolean> {
    return this.service.removePendingKickUser(guildId, userId);
  }

  async addPendingKickUserAndEnqueueJob(
    guildId: string,
    userId: string,
    enqueueJob: EnqueueCheckMessageJob,
  ): Promise<"added" | "already-pending" | "enqueue-failed"> {
    const wasAdded = await this.service.addPendingKickUser(guildId, userId);
    if (!wasAdded) {
      return "already-pending";
    }

    try {
      await enqueueJob(guildId, userId);
      return "added";
    } catch {
      await this.service.removePendingKickUser(guildId, userId);
      return "enqueue-failed";
    }
  }

  async queueEligibleMembers(
    guildId: string,
    userIds: string[],
    enqueueJob: EnqueueCheckMessageJob,
  ): Promise<CheckAllResult> {
    let addedCount = 0;
    let alreadyPendingCount = 0;
    let failedCount = 0;

    for (const userId of userIds) {
      const outcome = await this.addPendingKickUserAndEnqueueJob(
        guildId,
        userId,
        enqueueJob,
      );

      if (outcome === "already-pending") {
        alreadyPendingCount += 1;
        continue;
      }

      if (outcome === "enqueue-failed") {
        failedCount += 1;
        continue;
      }

      addedCount += 1;
    }

    return {
      addedCount,
      alreadyPendingCount,
      failedCount,
    };
  }

  async kickQueuedUsers(
    guildId: string,
    records: PendingKickRecord[],
    kickUserById: KickUserById,
  ): Promise<KickQueuedUsersResult> {
    let kickedCount = 0;
    let notFoundCount = 0;
    let failedCount = 0;

    for (const record of records) {
      const outcome = await kickUserById(record.discordUserId);
      if (outcome === "not-found") {
        notFoundCount += 1;
        continue;
      }

      if (outcome === "failed") {
        failedCount += 1;
        continue;
      }

      await this.service.removePendingKickUser(guildId, record.discordUserId);
      kickedCount += 1;
    }

    return {
      kickedCount,
      notFoundCount,
      failedCount,
    };
  }
}
