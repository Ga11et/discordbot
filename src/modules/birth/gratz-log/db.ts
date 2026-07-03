import type { Knex } from "knex";

const TABLE_NAME = "birthday_gratz_log";
const DEFAULT_LIMIT = 10;
const RECENT_MONTHS = 6;

interface GratzLogRow {
  id: number;
  guild_id: string;
  actor_id: string;
  target_user_id: string;
  created_at: string;
}

export interface GratzLogRecord {
  id: number;
  guildId: string;
  actorId: string;
  targetUserId: string;
  createdAt: Date;
}

function mapRowToRecord(row: GratzLogRow): GratzLogRecord {
  return {
    id: Number(row.id),
    guildId: row.guild_id,
    actorId: row.actor_id,
    targetUserId: row.target_user_id,
    createdAt: new Date(row.created_at),
  };
}

export class BirthdayGratzLogDb {
  constructor(private readonly client: Knex) {}

  async create(
    guildId: string,
    actorId: string,
    targetUserId: string,
  ): Promise<GratzLogRecord> {
    const [row] = await this.client<GratzLogRow>(TABLE_NAME)
      .insert({
        guild_id: guildId,
        actor_id: actorId,
        target_user_id: targetUserId,
      })
      .returning(["id", "guild_id", "actor_id", "target_user_id", "created_at"]);

    return mapRowToRecord(row);
  }

  async listRecent(
    targetUserId?: string,
    limit: number = DEFAULT_LIMIT,
  ): Promise<GratzLogRecord[]> {
    const query = this.client<GratzLogRow>(TABLE_NAME)
      .select("id", "guild_id", "actor_id", "target_user_id", "created_at")
      .orderBy("created_at", "desc")
      .orderBy("id", "desc")
      .limit(limit);

    if (targetUserId) {
      query.where("target_user_id", targetUserId);
    }

    const rows = await query;
    return rows.map(mapRowToRecord);
  }

  async deleteMostRecentByTarget(targetUserId: string): Promise<boolean> {
    const subquery = this.client(TABLE_NAME)
      .select("id")
      .where("target_user_id", targetUserId)
      .orderBy("created_at", "desc")
      .orderBy("id", "desc")
      .limit(1);

    const result = await this.client(TABLE_NAME).whereIn("id", subquery).del();

    return result > 0;
  }

  async hasRecentByTarget(
    targetUserId: string,
    months: number = RECENT_MONTHS,
  ): Promise<boolean> {
    const row = await this.client<GratzLogRow>(TABLE_NAME)
      .select("id")
      .where("target_user_id", targetUserId)
      .andWhere(
        "created_at",
        ">",
        this.client.raw(`NOW() - (? || ' months')::INTERVAL`, [String(months)]),
      )
      .first();

    return Boolean(row);
  }
}
