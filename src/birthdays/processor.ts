import { BirthdayCommandError } from "./errors";
import { birthdayDateUtils } from "./date-utils";
import { BirthdayService, birthdayService } from "./service";
import { GratzService, gratzService } from "./gratz-service";

export interface ListEntry {
  userId: string;
  birthdayLabel: string;
}

export interface ListResult {
  entries: ListEntry[];
}

const GRATZ_LIST_PREVIEW_LIMIT = 50;

function sanitizeMultilinePreview(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function trimPreview(text: string): string {
  if (text.length <= GRATZ_LIST_PREVIEW_LIMIT) {
    return text;
  }
  return `${text.slice(0, GRATZ_LIST_PREVIEW_LIMIT)}...`;
}

function parseMessageId(input: string): number {
  const parsed = Number(input);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BirthdayCommandError("INVALID_MESSAGE_ID");
  }

  return parsed;
}

export class BirthdayCommandProcessor {
  constructor(
    private readonly service: BirthdayService = birthdayService,
    private readonly gratz: GratzService = gratzService,
  ) {}

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

  async gratzUser(targetUserId: string): Promise<string> {
    const record = await this.gratz.getRandomGratzMessage();
    if (!record) {
      throw new BirthdayCommandError("GRATZ_MESSAGES_EMPTY");
    }

    return record.text.replaceAll("[user]", `<@${targetUserId}>`);
  }

  async createGratzMessage(text: string): Promise<string> {
    if (!text.trim()) {
      throw new BirthdayCommandError("GRATZ_MESSAGE_TEXT_EMPTY");
    }

    const result = await this.gratz.createGratzMessage(text);
    return `Поздравление сохранено с id ${result.id}`;
  }

  async getGratzMessage(messageIdInput: string): Promise<string> {
    const messageId = parseMessageId(messageIdInput);
    const record = await this.gratz.getGratzMessage(messageId);
    if (!record) {
      throw new BirthdayCommandError("GRATZ_MESSAGE_ID_NOT_FOUND");
    }

    return `id ${record.id}\n${record.text}`;
  }

  async deleteGratzMessage(messageIdInput: string): Promise<string> {
    const messageId = parseMessageId(messageIdInput);
    const removed = await this.gratz.deleteGratzMessage(messageId);
    if (!removed) {
      throw new BirthdayCommandError("GRATZ_MESSAGE_ID_NOT_FOUND");
    }

    return `Поздравление с id ${messageId} удалено`;
  }

  async listGratzMessages(): Promise<string> {
    const records = await this.gratz.listGratzMessages();
    if (records.length === 0) {
      throw new BirthdayCommandError("GRATZ_MESSAGES_EMPTY");
    }

    return records
      .map((record) => {
        const singleLine = sanitizeMultilinePreview(record.text);
        return `${record.id}. ${trimPreview(singleLine)}`;
      })
      .join("\n");
  }
}

export function createBirthdayCommandProcessor(
  service: BirthdayService = birthdayService,
  gratz: GratzService = gratzService,
): BirthdayCommandProcessor {
  return new BirthdayCommandProcessor(service, gratz);
}
