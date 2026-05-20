import DateUtils from "../../utils/date-utils";
import type { GratzMessageRecord } from "./services/gratz-service";

const GRATZ_LIST_PREVIEW_LIMIT = 200;
const dateUtils = new DateUtils();

function sanitizeMultilinePreview(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function trimPreview(text: string): string {
  if (text.length <= GRATZ_LIST_PREVIEW_LIMIT) {
    return text;
  }

  return `${text.slice(0, GRATZ_LIST_PREVIEW_LIMIT)}...`;
}

export default class BirthdayResponse {
  buildOwnBirthdayResponse(birthdayDate: Date): string {
    return `Твоя дата рождения: ${dateUtils.formatDateDisplay(birthdayDate)}`;
  }

  buildBirthdaySavedResponse(): string {
    return "Дата рождения сохранена!";
  }

  buildBirthdayUpdatedResponse(targetUserId: string): string {
    return `Дата рождения пользователя <@${targetUserId}> обновлена!`;
  }

  buildBirthdayDeletedResponse(targetUserId: string): string {
    return `Дата рождения пользователя <@${targetUserId}> удалена!`;
  }

  buildBirthdayNotFoundResponse(): string {
    return "Дата рождения не найдена. Установи её командой /bd set";
  }

  buildBirthdayForUserNotFoundResponse(targetUserId: string): string {
    return `Дата рождения пользователя <@${targetUserId}> не найдена`;
  }

  buildDateInputFormatError(): string {
    return "Используй формат даты ДД.ММ.ГГГГ, например 16.01.1998";
  }

  buildDateInvalidError(): string {
    return "Такой даты не существует";
  }

  buildDateFromFutureError(): string {
    return "Дата рождения не может быть из будущего";
  }

  buildBirthdayListResponse(
    entries: Array<{ userId: string; birthdayLabel: string }>,
  ): string {
    if (entries.length === 0) {
      return "Пока никто не добавил дату рождения";
    }

    return entries
      .map(
        (entry, index) =>
          `${index + 1}. <@${entry.userId}> — ${entry.birthdayLabel}`,
      )
      .join("\n");
  }

  buildGratzMessageSavedResponse(id: number): string {
    return `Поздравление сохранено с id ${id}`;
  }

  buildGratzMessageByIdResponse(record: GratzMessageRecord): string {
    return `id ${record.id}\n${record.text}`;
  }

  buildGratzMessageDeletedResponse(messageId: number): string {
    return `Поздравление с id ${messageId} удалено`;
  }

  buildGratzMessagesListResponse(records: GratzMessageRecord[]): string {
    return records
      .map((record) => {
        const singleLine = sanitizeMultilinePreview(record.text);
        return `${record.id}. ${trimPreview(singleLine)}`;
      })
      .join("\n");
  }

  buildGratzMessagesEmptyError(): string {
    return "Пока нет ни одного поздравления. Добавь через /bd gratzmessage create";
  }

  buildGratzMessageNotFoundError(): string {
    return "Поздравление с таким id не найдено";
  }

  buildGratzMessageTextEmptyError(): string {
    return "Текст поздравления не может быть пустым";
  }

  buildMessageIdInvalidError(): string {
    return "messageid должен быть положительным числом";
  }

  buildUnknownGratzSubcommandError(): string {
    return "Неизвестная подкоманда gratzmessage";
  }

  buildUnknownSubcommandError(): string {
    return "Неизвестная подкоманда";
  }

  buildUnexpectedError(): string {
    return "Что-то пошло не так. Попробуй позже";
  }
}
