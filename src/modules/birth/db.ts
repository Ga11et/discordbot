import type { Knex } from "knex";
import { dateUtils } from "../../utils/date-utils";

const TABLE_NAME = "birthdays";
const LIST_LIMIT = 20;

interface BirthdayRow {
  discord_user_id: string;
  birthday_date: string;
}

export interface BirthdayRecord {
  discordUserId: string;
  birthdayDate: Date;
}

function mapRow(row: BirthdayRow): BirthdayRecord {
  return {
    discordUserId: row.discord_user_id,
    birthdayDate: dateUtils.fromIsoDateString(row.birthday_date),
  };
}

export class BirthDb {
  constructor(private readonly client: Knex) {}

  async getBirthday(discordUserId: string): Promise<BirthdayRecord | null> {
    const row = await this.client<BirthdayRow>(TABLE_NAME)
      .select("discord_user_id", "birthday_date")
      .where("discord_user_id", discordUserId)
      .first();

    return row ? mapRow(row) : null;
  }

  async upsertBirthday(discordUserId: string, birthdayDate: Date): Promise<void> {
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

  async deleteBirthday(discordUserId: string): Promise<boolean> {
    const affected = await this.client(TABLE_NAME)
      .where("discord_user_id", discordUserId)
      .del();

    return affected > 0;
  }

  async listBirthdays(): Promise<BirthdayRecord[]> {
    const rows = await this.client<BirthdayRow>(TABLE_NAME)
      .select("discord_user_id", "birthday_date")
      .limit(LIST_LIMIT);

    const records = rows.map(mapRow);

    records.sort((a: BirthdayRecord, b: BirthdayRecord) => {
      const monthDiff = a.birthdayDate.getUTCMonth() - b.birthdayDate.getUTCMonth();
      if (monthDiff !== 0) return monthDiff;

      const dayDiff = a.birthdayDate.getUTCDate() - b.birthdayDate.getUTCDate();
      if (dayDiff !== 0) return dayDiff;

      return a.discordUserId.localeCompare(b.discordUserId);
    });

    return records;
  }
}
