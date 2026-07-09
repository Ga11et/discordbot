import { dateUtils } from "../../utils/date-utils";
import type { BirthdayListEntry, SetBirthdayResult } from "../../modules/birth/base/controller";
import type { PendingBirthRecord } from "../../modules/birth/check-queue/controller";
import type { GratzLogRecord } from "../../modules/birth/gratz-log/controller";
import type { GratzMessageRecord } from "../../modules/birth/gratz-message/controller";

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

  gratzLogList(records: GratzLogRecord[]): string {
    if (records.length === 0) {
      return "Поздравлений не найдено";
    }

    return records
      .map((record, index) => {
        const date = dateUtils.formatDateDisplay(record.createdAt);
        return `${index + 1}. ${date} — <@${record.actorId}> поздравил <@${record.targetUserId}>`;
      })
      .join("\n");
  }

  gratzLogDeleteSuccess(targetUserId: string): string {
    return `Последняя запись поздравления для <@${targetUserId}> удалена`;
  }

  gratzLogDeleteNotFound(targetUserId: string): string {
    return `Не найдено записей поздравлений для <@${targetUserId}>`;
  }

  gratzMessageSaved(id: number): string {
    return `Поздравление сохранено с id ${id}`;
  }

  gratzMessageById(record: GratzMessageRecord): string {
    return `id ${record.id}\n${record.text}`;
  }

  gratzMessageDeleted(id: number): string {
    return `Поздравление с id ${id} удалено`;
  }

  gratzMessageList(records: GratzMessageRecord[]): string {
    const PREVIEW_LIMIT = 200;
    return records
      .map((record) => {
        const singleLine = record.text.replace(/\s+/g, " ").trim();
        const preview =
          singleLine.length <= PREVIEW_LIMIT
            ? singleLine
            : `${singleLine.slice(0, PREVIEW_LIMIT)}...`;
        return `${record.id}. ${preview}`;
      })
      .join("\n");
  }

  gratzMessageEmptyError(): string {
    return "Пока нет ни одного поздравления. Добавь через /bd gratzmessage create";
  }

  gratzMessageNotFoundError(): string {
    return "Поздравление с таким id не найдено";
  }

  gratzMessageTextEmptyError(): string {
    return "Текст поздравления не может быть пустым";
  }

  gratzMessageIdInvalidError(): string {
    return "messageid должен быть положительным числом";
  }
}

export const birthResponse = new BirthResponse();
