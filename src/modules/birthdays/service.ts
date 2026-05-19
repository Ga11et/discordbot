import type { Knex } from "knex";
import db from "../../db";
import DateUtils from "../../utils/date-utils";

export interface BirthdayRecord {
  discordUserId: string;
  birthdayDate: Date;
}

const LIST_LIMIT = 100;
const TABLE_NAME = "birthdays";
const dateUtils = new DateUtils();

interface BirthdayRow {
  discord_user_id: string;
  birthday_date: string;
  created_at?: string;
  updated_at?: string;
}

function mapRowToRecord(row: BirthdayRow): BirthdayRecord {
  return {
    discordUserId: row.discord_user_id,
    birthdayDate: dateUtils.fromIsoDateString(row.birthday_date),
  };
}

export class BirthdayService {
  constructor(private readonly client: Knex) {}

  async upsertBirthday(
    discordUserId: string,
    birthdayDate: Date,
  ): Promise<void> {
    const isoDate = dateUtils.toIsoDateString(birthdayDate);
    const now = this.client.fn.now();

    await this.client(TABLE_NAME)
      .insert({
        discord_user_id: discordUserId,
        birthday_date: isoDate,
        created_at: now,
        updated_at: now,
      })
      .onConflict("discord_user_id")
      .merge({
        birthday_date: isoDate,
        updated_at: this.client.fn.now(),
      });
  }

  async getBirthday(discordUserId: string): Promise<BirthdayRecord | null> {
    const row = await this.client<BirthdayRow>(TABLE_NAME)
      .select("discord_user_id", "birthday_date")
      .where("discord_user_id", discordUserId)
      .first();

    if (!row) {
      return null;
    }

    return mapRowToRecord(row);
  }

  async deleteBirthday(discordUserId: string): Promise<boolean> {
    const affectedRows = await this.client(TABLE_NAME)
      .where("discord_user_id", discordUserId)
      .del();

    return affectedRows > 0;
  }

  async listBirthdays(): Promise<BirthdayRecord[]> {
    const rows = await this.client<BirthdayRow>(TABLE_NAME)
      .select("discord_user_id", "birthday_date")
      .limit(LIST_LIMIT);

    const records = rows.map(mapRowToRecord);
    records.sort((left, right) => {
      const monthDiff =
        left.birthdayDate.getUTCMonth() - right.birthdayDate.getUTCMonth();
      if (monthDiff !== 0) {
        return monthDiff;
      }

      const dayDiff =
        left.birthdayDate.getUTCDate() - right.birthdayDate.getUTCDate();
      if (dayDiff !== 0) {
        return dayDiff;
      }

      return left.discordUserId.localeCompare(right.discordUserId);
    });

    return records;
  }
}

export function createBirthdayService(
  customClient: Knex = db.client,
): BirthdayService {
  return new BirthdayService(customClient);
}

export const birthdayService = createBirthdayService();
