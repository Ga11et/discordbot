import type { Knex } from "knex";
import db from "../db";

const TABLE_NAME = "kick_queue";
const LIST_LIMIT = 100;

interface KickQueueRow {
  guild_id: string;
  discord_user_id: string;
}

interface KickQueueInsertRow {
  guild_id: string;
  discord_user_id: string;
  created_at: Knex.Value;
  updated_at: Knex.Value;
}

export interface PendingKickRecord {
  guildId: string;
  discordUserId: string;
}

function mapRowToRecord(row: KickQueueRow): PendingKickRecord {
  return {
    guildId: row.guild_id,
    discordUserId: row.discord_user_id,
  };
}

export class KickQueueService {
  constructor(private readonly client: Knex) {}

  async listPendingKickUsers(
    guildId: string,
    limit: number = LIST_LIMIT,
  ): Promise<PendingKickRecord[]> {
    const rows = await this.client<KickQueueRow>(TABLE_NAME)
      .select("guild_id", "discord_user_id")
      .where("guild_id", guildId)
      .orderBy("created_at", "asc")
      .orderBy("discord_user_id", "asc")
      .limit(limit);

    return rows.map(mapRowToRecord);
  }

  async addPendingKickUser(
    guildId: string,
    discordUserId: string,
  ): Promise<boolean> {
    const now = this.client.fn.now();

    const [insertedRow] = await this.client<KickQueueInsertRow>(TABLE_NAME)
      .insert({
        guild_id: guildId,
        discord_user_id: discordUserId,
        created_at: now,
        updated_at: now,
      })
      .onConflict(["guild_id", "discord_user_id"])
      .ignore()
      .returning(["discord_user_id"]);

    if (insertedRow) {
      return true;
    }

    await this.client(TABLE_NAME)
      .where({
        guild_id: guildId,
        discord_user_id: discordUserId,
      })
      .update({
        updated_at: this.client.fn.now(),
      });

    return false;
  }

  async removePendingKickUser(
    guildId: string,
    discordUserId: string,
  ): Promise<boolean> {
    const affectedRows = await this.client(TABLE_NAME)
      .where({
        guild_id: guildId,
        discord_user_id: discordUserId,
      })
      .del();

    return affectedRows > 0;
  }
}

export function createKickQueueService(
  customClient: Knex = db.client,
): KickQueueService {
  return new KickQueueService(customClient);
}

export const kickQueueService = createKickQueueService();
