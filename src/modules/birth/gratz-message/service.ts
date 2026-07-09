import type { Knex } from "knex";
import { AppError } from "../../../utils/errors";
import { GratzMessageDb, type GratzMessageRecord } from "./db";

export type { GratzMessageRecord };

export function parseMessageId(input: string): number {
  const parsed = Number(input);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError("INVALID_INPUT");
  }

  return parsed;
}

export class GratzMessageService {
  private readonly db: GratzMessageDb;

  constructor(client: Knex) {
    this.db = new GratzMessageDb(client);
  }

  async create(text: string): Promise<GratzMessageRecord> {
    if (!text.trim()) {
      throw new AppError("EMPTY_VALUE");
    }

    return this.db.create(text);
  }

  async getById(id: number): Promise<GratzMessageRecord> {
    const record = await this.db.getById(id);
    if (!record) {
      throw new AppError("NOT_FOUND");
    }

    return record;
  }

  async delete(id: number): Promise<GratzMessageRecord> {
    const record = await this.db.getById(id);
    if (!record) {
      throw new AppError("NOT_FOUND");
    }

    await this.db.delete(id);
    return record;
  }

  async list(): Promise<GratzMessageRecord[]> {
    const records = await this.db.list();
    if (records.length === 0) {
      throw new AppError("NOT_FOUND");
    }

    return records;
  }

  async getRandom(): Promise<GratzMessageRecord> {
    const record = await this.db.getRandom();
    if (!record) {
      throw new AppError("NOT_FOUND");
    }

    return record;
  }

  async gratzUser(
    targetUserId: string,
    messageId?: number,
  ): Promise<GratzMessageRecord> {
    const record = messageId
      ? await this.db.getById(messageId)
      : await this.db.getRandom();

    if (!record) {
      throw new AppError("NOT_FOUND");
    }

    return record;
  }
}
