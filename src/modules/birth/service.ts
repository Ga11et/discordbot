import type { Knex } from "knex";
import { AppError } from "../../utils/errors";
import { dateUtils } from "../../utils/date-utils";
import { BirthDb, type BirthdayRecord } from "./db";
import { BirthCheckQueueDb, type PendingBirthRecord } from "./check-queue-db";

export type { PendingBirthRecord };

export type SetBirthdayResult =
  | { type: "self" }
  | { type: "other"; targetUserId: string };

export interface BirthdayListEntry {
  userId: string;
  birthdayDate: Date;
  birthdayLabel: string;
}

export class BirthService {
  private readonly birthDb: BirthDb;
  private readonly checkQueueDb: BirthCheckQueueDb;

  constructor(client: Knex) {
    this.birthDb = new BirthDb(client);
    this.checkQueueDb = new BirthCheckQueueDb(client);
  }

  async getOwnBirthday(userId: string): Promise<BirthdayRecord> {
    const record = await this.birthDb.getBirthday(userId);
    if (!record) {
      throw new AppError("NOT_FOUND");
    }

    return record;
  }

  async getBirthday(targetUserId: string): Promise<BirthdayRecord | null> {
    return this.birthDb.getBirthday(targetUserId);
  }

  async setBirthday(
    actorId: string,
    dateInput: string,
    targetUserId?: string,
  ): Promise<SetBirthdayResult> {
    let parsed: Date;
    try {
      parsed = dateUtils.parseDayMonth(dateInput);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("INTERNAL_ERROR");
    }

    const userIdToUpdate = targetUserId ?? actorId;
    await this.birthDb.upsertBirthday(userIdToUpdate, parsed);

    if (userIdToUpdate === actorId) {
      return { type: "self" };
    }

    return { type: "other", targetUserId: userIdToUpdate };
  }

  async deleteBirthday(targetUserId: string): Promise<{ targetUserId: string }> {
    const removed = await this.birthDb.deleteBirthday(targetUserId);
    if (!removed) {
      throw new AppError("NOT_FOUND");
    }

    return { targetUserId };
  }

  async addToCheckQueue(guildId: string, userId: string): Promise<boolean> {
    return this.checkQueueDb.addPending(guildId, userId);
  }

  async removeFromCheckQueue(guildId: string, userId: string): Promise<boolean> {
    return this.checkQueueDb.removePending(guildId, userId);
  }

  async listCheckQueue(guildId: string): Promise<PendingBirthRecord[]> {
    return this.checkQueueDb.listPending(guildId);
  }

  async listBirthdays(): Promise<BirthdayListEntry[]> {
    const records = await this.birthDb.listBirthdays();

    return records.map((record: BirthdayRecord) => ({
      userId: record.discordUserId,
      birthdayDate: record.birthdayDate,
      birthdayLabel: dateUtils.formatDayMonth(record.birthdayDate),
    }));
  }
}
