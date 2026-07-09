import type { Knex } from "knex";

const TABLE_NAME = "birth_check_queue";
const LIST_LIMIT = 200;

interface BirthCheckQueueRow {
  guild_id: string;
  discord_user_id: string;
}

interface BirthCheckQueueInsertRow {
  guild_id: string;
  discord_user_id: string;
  created_at: Knex.Value;
  updated_at: Knex.Value;
}

export interface PendingBirthRecord {
  guildId: string;
  discordUserId: string;
}

function mapRowToRecord(row: BirthCheckQueueRow): PendingBirthRecord {
  return {
    guildId: row.guild_id,
    discordUserId: row.discord_user_id,
  };
}

export class BirthCheckQueueDb {
  constructor(private readonly client: Knex) {}

  async addPending(guildId: string, discordUserId: string): Promise<boolean> {
    const now = this.client.fn.now();

    const [insertedRow] = await this.client<BirthCheckQueueInsertRow>(TABLE_NAME)
      .insert({
        guild_id: guildId,
        discord_user_id: discordUserId,
        created_at: now,
        updated_at: now,
      })
      .onConflict(["guild_id", "discord_user_id"])
      .ignore()
      .returning(["discord_user_id"]);

    return !!insertedRow;
  }

  async removePending(guildId: string, discordUserId: string): Promise<boolean> {
    const affectedRows = await this.client(TABLE_NAME)
      .where({
        guild_id: guildId,
        discord_user_id: discordUserId,
      })
      .del();

    return affectedRows > 0;
  }

  async listPending(
    guildId: string,
    limit: number = LIST_LIMIT,
  ): Promise<PendingBirthRecord[]> {
    const rows = await this.client<BirthCheckQueueRow>(TABLE_NAME)
      .select("guild_id", "discord_user_id")
      .where("guild_id", guildId)
      .orderBy("created_at", "asc")
      .orderBy("discord_user_id", "asc")
      .limit(limit);

    return rows.map(mapRowToRecord);
  }
}
