import type { Knex } from "knex";
import {
  BirthService,
  type SetBirthdayResult,
  type BirthdayListEntry,
} from "./service";
import type { BirthdayRecord } from "./db";

export type { SetBirthdayResult, BirthdayListEntry };

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
}
