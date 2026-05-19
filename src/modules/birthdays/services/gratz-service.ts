import type { Knex } from "knex";

const TABLE_NAME = "birthday_gratz_messages";
const LIST_LIMIT = 100;

interface GratzMessageRow {
  id: number;
  message_text: string;
}

export interface GratzMessageRecord {
  id: number;
  text: string;
}

function mapRowToRecord(row: GratzMessageRow): GratzMessageRecord {
  return {
    id: row.id,
    text: row.message_text,
  };
}

export default class GratzService {
  constructor(private readonly client: Knex) {}

  async createGratzMessage(text: string): Promise<{ id: number }> {
    const now = this.client.fn.now();
    const [row] = await this.client(TABLE_NAME)
      .insert({
        message_text: text,
        created_at: now,
        updated_at: now,
      })
      .returning<{ id: number }[]>("id");

    return { id: row.id };
  }

  async deleteGratzMessage(id: number): Promise<boolean> {
    const affectedRows = await this.client(TABLE_NAME).where("id", id).del();
    return affectedRows > 0;
  }

  async getGratzMessage(id: number): Promise<GratzMessageRecord | null> {
    const row = await this.client<GratzMessageRow>(TABLE_NAME)
      .select("id", "message_text")
      .where("id", id)
      .first();

    if (!row) {
      return null;
    }

    return mapRowToRecord(row);
  }

  async listGratzMessages(
    limit: number = LIST_LIMIT,
  ): Promise<GratzMessageRecord[]> {
    const rows = await this.client<GratzMessageRow>(TABLE_NAME)
      .select("id", "message_text")
      .orderBy("id", "asc")
      .limit(limit);

    return rows.map(mapRowToRecord);
  }

  async getRandomGratzMessage(): Promise<GratzMessageRecord | null> {
    const row = await this.client<GratzMessageRow>(TABLE_NAME)
      .select("id", "message_text")
      .orderByRaw("random()")
      .first();

    if (!row) {
      return null;
    }

    return mapRowToRecord(row);
  }
}
