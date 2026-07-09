import type { Knex } from "knex";
import { BirthCheckQueueService, type PendingBirthRecord } from "./service";

export type { PendingBirthRecord };

export class BirthCheckQueueController {
  private readonly service: BirthCheckQueueService;

  constructor(client: Knex) {
    this.service = new BirthCheckQueueService(client);
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
