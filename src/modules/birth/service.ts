import type { Knex } from "knex";
import { AppError } from "../../utils/errors";
import { dateUtils } from "../../utils/date-utils";
import { BirthDb, type BirthdayRecord } from "./db";

export type SetBirthdayResult =
  | { type: "self" }
  | { type: "other"; targetUserId: string };

export interface BirthdayListEntry {
  userId: string;
  birthdayDate: Date;
  birthdayLabel: string;
}

export class BirthService {
  private readonly db: BirthDb;

  constructor(client: Knex) {
    this.db = new BirthDb(client);
  }

  async getOwnBirthday(userId: string): Promise<BirthdayRecord> {
    const record = await this.db.getBirthday(userId);
    if (!record) {
      throw new AppError("NOT_FOUND");
    }

    return record;
  }

  async getBirthday(targetUserId: string): Promise<BirthdayRecord | null> {
    return this.db.getBirthday(targetUserId);
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
    await this.db.upsertBirthday(userIdToUpdate, parsed);

    if (userIdToUpdate === actorId) {
      return { type: "self" };
    }

    return { type: "other", targetUserId: userIdToUpdate };
  }

  async deleteBirthday(targetUserId: string): Promise<{ targetUserId: string }> {
    const removed = await this.db.deleteBirthday(targetUserId);
    if (!removed) {
      throw new AppError("NOT_FOUND");
    }

    return { targetUserId };
  }

  async listBirthdays(): Promise<BirthdayListEntry[]> {
    const records = await this.db.listBirthdays();

    return records.map((record: BirthdayRecord) => ({
      userId: record.discordUserId,
      birthdayDate: record.birthdayDate,
      birthdayLabel: dateUtils.formatDayMonth(record.birthdayDate),
    }));
  }
}
