import { BirthdayCommandError } from "./errors";
import { birthdayDateUtils } from "./date-utils";
import { BirthdayService, birthdayService } from "./service";

export interface ListEntry {
  userId: string;
  birthdayLabel: string;
}

export interface ListResult {
  entries: ListEntry[];
}

export class BirthdayCommandProcessor {
  constructor(private readonly service: BirthdayService = birthdayService) {}

  async showOwnBirthday(userId: string): Promise<string> {
    const record = await this.service.getBirthday(userId);
    if (!record) {
      throw new BirthdayCommandError("NOT_FOUND");
    }

    return `Твоя дата рождения: ${birthdayDateUtils.formatBirthdayDisplay(record.birthdayDate)}`;
  }

  async setBirthday(
    actorId: string,
    dateInput: string,
    targetUserId?: string,
  ): Promise<string> {
    const parsed = birthdayDateUtils.parseBirthdayInput(dateInput);
    const userIdToUpdate = targetUserId ?? actorId;

    await this.service.upsertBirthday(userIdToUpdate, parsed);

    if (userIdToUpdate === actorId) {
      return "Дата рождения сохранена!";
    }

    return `Дата рождения пользователя <@${userIdToUpdate}> обновлена!`;
  }

  async listBirthdays(): Promise<ListResult> {
    const records = await this.service.listBirthdays();
    return {
      entries: records.map((record) => ({
        userId: record.discordUserId,
        birthdayLabel: birthdayDateUtils.formatBirthdayDisplay(
          record.birthdayDate,
        ),
      })),
    };
  }
}

export function createBirthdayCommandProcessor(
  service: BirthdayService = birthdayService,
): BirthdayCommandProcessor {
  return new BirthdayCommandProcessor(service);
}
