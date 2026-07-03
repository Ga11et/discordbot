import type { Knex } from "knex";
import {
  BirthdayGratzLogService,
  type GratzLogRecord,
} from "./service";

export type { GratzLogRecord };

export class BirthdayGratzLogController {
  private readonly service: BirthdayGratzLogService;

  constructor(client: Knex, service?: BirthdayGratzLogService) {
    this.service = service ?? new BirthdayGratzLogService(client);
  }

  async createLog(
    guildId: string,
    actorId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.service.createLog(guildId, actorId, targetUserId);
  }

  async listRecent(
    targetUserId?: string,
    limit: number = 10,
  ): Promise<GratzLogRecord[]> {
    return this.service.listRecent(targetUserId, limit);
  }

  async deleteMostRecentByTarget(
    targetUserId: string,
  ): Promise<{ targetUserId: string }> {
    return this.service.deleteMostRecentByTarget(targetUserId);
  }

  async hasRecentGreeting(
    targetUserId: string,
    months: number = 6,
  ): Promise<boolean> {
    return this.service.hasRecentGreeting(targetUserId, months);
  }
}
