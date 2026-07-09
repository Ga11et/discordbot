import type { Knex } from "knex";
import {
  GratzMessageService,
  parseMessageId,
  type GratzMessageRecord,
} from "./service";

export type { GratzMessageRecord };

export class GratzMessageController {
  private readonly service: GratzMessageService;

  constructor(client: Knex, service?: GratzMessageService) {
    this.service = service ?? new GratzMessageService(client);
  }

  async createGratzMessage(text: string): Promise<GratzMessageRecord> {
    return this.service.create(text);
  }

  async getGratzMessage(messageIdInput: string): Promise<GratzMessageRecord> {
    const id = parseMessageId(messageIdInput);
    return this.service.getById(id);
  }

  async deleteGratzMessage(messageIdInput: string): Promise<GratzMessageRecord> {
    const id = parseMessageId(messageIdInput);
    return this.service.delete(id);
  }

  async listGratzMessages(): Promise<GratzMessageRecord[]> {
    return this.service.list();
  }

  async gratzUser(
    targetUserId: string,
    messageIdInput?: string,
  ): Promise<string> {
    const messageId = messageIdInput
      ? parseMessageId(messageIdInput)
      : undefined;
    const record = await this.service.gratzUser(targetUserId, messageId);
    return record.text.replaceAll("[user]", `<@${targetUserId}>`);
  }

  async getRandomGratzMessage(): Promise<GratzMessageRecord> {
    return this.service.getRandom();
  }
}
