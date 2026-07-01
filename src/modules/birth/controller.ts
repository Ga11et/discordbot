import type { Knex } from "knex";
import {
  BirthService,
  type SetBirthdayResult,
  type BirthdayListEntry,
  type PendingBirthRecord,
} from "./service";
import type { BirthdayRecord } from "./db";

export type { SetBirthdayResult, BirthdayListEntry, PendingBirthRecord };

export class BirthController {
  private readonly service: BirthService;

  constructor(client: Knex) {
    this.service = new BirthService(client);
  }

  async getOwnBirthday(userId: string): Promise<BirthdayRecord> {
    return this.service.getOwnBirthday(userId);
  }

  async getBirthday(targetUserId: string): Promise<BirthdayRecord | null> {
    return this.service.getBirthday(targetUserId);
  }

  async setBirthday(
    actorId: string,
    dateInput: string,
    targetUserId?: string,
  ): Promise<SetBirthdayResult> {
    return this.service.setBirthday(actorId, dateInput, targetUserId);
  }

  async deleteBirthday(
    targetUserId: string,
  ): Promise<{ targetUserId: string }> {
    return this.service.deleteBirthday(targetUserId);
  }

  async listBirthdays(): Promise<BirthdayListEntry[]> {
    return this.service.listBirthdays();
  }

  async addToCheckQueue(guildId: string, userId: string): Promise<boolean> {
    return this.service.addToCheckQueue(guildId, userId);
  }

  async removeFromCheckQueue(guildId: string, userId: string): Promise<boolean> {
    return this.service.removeFromCheckQueue(guildId, userId);
  }

  async listCheckQueue(guildId: string): Promise<PendingBirthRecord[]> {
    return this.service.listCheckQueue(guildId);
  }
}
