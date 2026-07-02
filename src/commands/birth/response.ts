import { dateUtils } from "../../utils/date-utils";
import type { BirthdayListEntry, SetBirthdayResult, PendingBirthRecord } from "../../modules/birth/controller";

export interface CheckAllResult {
  added: number;
  alreadyPending: number;
  alreadySet: number;
  failed: number;
}

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

  checkEnqueued(userId: string): string {
    return `Пользователь <@${userId}> добавлен в очередь на запрос даты рождения`;
  }

  checkAlreadySet(userId: string): string {
    return `У <@${userId}> уже установлена дата рождения`;
  }

  checkAlreadyPending(userId: string): string {
    return `Пользователь <@${userId}> уже находится в очереди`;
  }

  checkEnqueueFailed(userId: string): string {
    return `Не удалось добавить <@${userId}> в очередь`;
  }

  checkAllResult(result: CheckAllResult): string {
    const lines: string[] = [];

    if (result.added > 0) {
      lines.push(`✅ Добавлено в очередь: **${result.added}**`);
    }
    if (result.alreadyPending > 0) {
      lines.push(`⏳ Уже в очереди: **${result.alreadyPending}**`);
    }
    if (result.alreadySet > 0) {
      lines.push(`📅 Дата уже установлена: **${result.alreadySet}**`);
    }
    if (result.failed > 0) {
      lines.push(`❌ Ошибки добавления: **${result.failed}**`);
    }

    if (lines.length === 0) {
      return "Нет участников для добавления в очередь";
    }

    return lines.join("\n");
  }

  dequeueSuccess(userId: string): string {
    return `Пользователь <@${userId}> удалён из очереди`;
  }

  dequeueNotFound(userId: string): string {
    return `Пользователь <@${userId}> не найден в очереди`;
  }

  checkQueue(records: PendingBirthRecord[]): string {
    if (records.length === 0) {
      return "Очередь на запрос даты рождения пуста";
    }

    return (
      `Очередь на запрос даты рождения (${records.length}):\n` +
      records.map((r, i) => `${i + 1}. <@${r.discordUserId}>`).join("\n")
    );
  }
}

export const birthResponse = new BirthResponse();
