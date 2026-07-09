import type { GratzMessageRecord } from "./services/gratz-service";

const GRATZ_LIST_PREVIEW_LIMIT = 200;

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
