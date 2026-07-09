import type { Knex } from "knex";
import { BirthCheckQueueDb, type PendingBirthRecord } from "./db";

export type { PendingBirthRecord };

export class BirthCheckQueueService {
  private readonly checkQueueDb: BirthCheckQueueDb;

  constructor(client: Knex) {
    this.checkQueueDb = new BirthCheckQueueDb(client);
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
}
