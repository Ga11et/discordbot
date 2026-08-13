import type { Knex } from "knex";

const TABLE_NAME = "birthday_gratz_messages";
const LIST_LIMIT = 100;

interface GratzMessageRow {
  id: string | number;
  message_text: string;
}

interface GratzMessageInsertRow {
  message_text: string;
  created_at: unknown;
  updated_at: unknown;
}

export interface GratzMessageRecord {
  id: number;
  text: string;
}

function mapRowToRecord(row: GratzMessageRow): GratzMessageRecord {
  return {
    id: Number(row.id),
    text: row.message_text,
  };
}

export class GratzMessageDb {
  constructor(private readonly client: Knex) {}

  async create(text: string): Promise<GratzMessageRecord> {
    const now = this.client.fn.now();
    const [row] = await this.client<GratzMessageInsertRow>(TABLE_NAME)
      .insert({
        message_text: text,
        created_at: now,
        updated_at: now,
      })
      .returning<GratzMessageRow[]>(["id", "message_text"]);

    return mapRowToRecord(row);
  }

  async getById(id: number): Promise<GratzMessageRecord | null> {
    const row = await this.client<GratzMessageRow>(TABLE_NAME)
      .select("id", "message_text")
      .where("id", id)
      .first();

    if (!row) {
      return null;
    }

    return mapRowToRecord(row);
  }

  async delete(id: number): Promise<boolean> {
    const affected = await this.client(TABLE_NAME).where("id", id).del();
    return affected > 0;
  }

  async list(limit: number = LIST_LIMIT): Promise<GratzMessageRecord[]> {
    const rows = await this.client<GratzMessageRow>(TABLE_NAME)
      .select("id", "message_text")
      .orderBy("id", "asc")
      .limit(limit);

    return rows.map(mapRowToRecord);
  }

  async getRandom(): Promise<GratzMessageRecord | null> {
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
