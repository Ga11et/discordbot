import { dateUtils } from "../../utils/date-utils";
import type { BirthdayListEntry, SetBirthdayResult } from "../../modules/birth/controller";

export class BirthResponse {
  ownBirthday(birthdayDate: Date): string {
    return `Твоя дата рождения: ${dateUtils.formatDayMonth(birthdayDate)}`;
  }

  setBirthday(result: SetBirthdayResult): string {
    if (result.type === "self") {
      return "Дата рождения сохранена!";
    }
    return `Дата рождения пользователя <@${result.targetUserId}> обновлена!`;
  }

  deleteBirthday(targetUserId: string): string {
    return `Дата рождения пользователя <@${targetUserId}> удалена!`;
  }

  listBirthdays(entries: BirthdayListEntry[]): string {
    if (entries.length === 0) {
      return "Пока никто не добавил дату рождения";
    }

    return entries
      .map((entry, index) => `${index + 1}. <@${entry.userId}> — ${entry.birthdayLabel}`)
      .join("\n");
  }

  userBirthday(targetUserId: string, birthdayDate: Date): string {
    return `Дата рождения <@${targetUserId}>: ${dateUtils.formatDayMonth(birthdayDate)}`;
  }

  userBirthdayNotFound(targetUserId: string): string {
    return `У <@${targetUserId}> не указана дата рождения`;
  }

  notFound(): string {
    return "Дата рождения не найдена. Установи её командой /birth set";
  }

  userNotFound(targetUserId: string): string {
    return `Дата рождения пользователя <@${targetUserId}> не найдена`;
  }

  dateFormatError(): string {
    return "Используй формат даты ДД.ММ, например 16.01";
  }

  dateInvalidError(): string {
    return "Такой даты не существует";
  }

  unexpectedError(): string {
    return "Что-то пошло не так. Попробуй позже";
  }
}

export const birthResponse = new BirthResponse();
