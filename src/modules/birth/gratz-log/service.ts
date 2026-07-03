import type { Knex } from "knex";
import { AppError } from "../../../utils/errors";
import { BirthdayGratzLogDb, type GratzLogRecord } from "./db";

export type { GratzLogRecord };

export class BirthdayGratzLogService {
  private readonly db: BirthdayGratzLogDb;

  constructor(client: Knex) {
    this.db = new BirthdayGratzLogDb(client);
  }

  async createLog(
    guildId: string,
    actorId: string,
    targetUserId: string,
  ): Promise<GratzLogRecord> {
    return this.db.create(guildId, actorId, targetUserId);
  }

  async listRecent(
    targetUserId?: string,
    limit: number = 10,
  ): Promise<GratzLogRecord[]> {
    return this.db.listRecent(targetUserId, limit);
  }

  async deleteMostRecentByTarget(
    targetUserId: string,
  ): Promise<{ targetUserId: string }> {
    const deleted = await this.db.deleteMostRecentByTarget(targetUserId);
    if (!deleted) {
      throw new AppError("NOT_FOUND");
    }

    return { targetUserId };
  }

  async hasRecentGreeting(
    targetUserId: string,
    months: number = 6,
  ): Promise<boolean> {
    return this.db.hasRecentByTarget(targetUserId, months);
  }
}
