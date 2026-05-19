import { AppError } from "../../utils/errors";
import DateUtils from "../../utils/date-utils";
import BirthdayService from "./services/birthday-service";
import GratzService from "./services/gratz-service";

export interface ListEntry {
  userId: string;
  birthdayLabel: string;
}

export interface ListResult {
  entries: ListEntry[];
}

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

function parseMessageId(input: string): number {
  const parsed = Number(input);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError("INVALID_MESSAGE_ID");
  }

  return parsed;
}

export class BirthdayCommandProcessor {
  constructor(
    private readonly birthdayService: BirthdayService,
    private readonly gratzService: GratzService,
  ) {}

  async showOwnBirthday(userId: string): Promise<string> {
    const record = await this.birthdayService.getBirthday(userId);
    if (!record) {
      throw new AppError("NOT_FOUND");
    }

    return `Твоя дата рождения: ${dateUtils.formatDateDisplay(record.birthdayDate)}`;
  }

  async setBirthday(
    actorId: string,
    dateInput: string,
    targetUserId?: string,
  ): Promise<string> {
    const parsed = dateUtils.parseDateInput(dateInput);
    const userIdToUpdate = targetUserId ?? actorId;

    await this.birthdayService.upsertBirthday(userIdToUpdate, parsed);

    if (userIdToUpdate === actorId) {
      return "Дата рождения сохранена!";
    }

    return `Дата рождения пользователя <@${userIdToUpdate}> обновлена!`;
  }

  async deleteBirthday(targetUserId: string): Promise<string> {
    const removed = await this.birthdayService.deleteBirthday(targetUserId);
    if (!removed) {
      throw new AppError(
        "NOT_FOUND",
        `Дата рождения пользователя <@${targetUserId}> не найдена`,
      );
    }

    return `Дата рождения пользователя <@${targetUserId}> удалена!`;
  }

  async listBirthdays(): Promise<ListResult> {
    const records = await this.birthdayService.listBirthdays();
    return {
      entries: records.map((record) => ({
        userId: record.discordUserId,
        birthdayLabel: dateUtils.formatDateDisplay(record.birthdayDate),
      })),
    };
  }

  async gratzUser(
    targetUserId: string,
    messageIdInput?: string,
  ): Promise<string> {
    const record = messageIdInput
      ? await this.gratzService.getGratzMessage(parseMessageId(messageIdInput))
      : await this.gratzService.getRandomGratzMessage();

    if (!record) {
      throw new AppError(
        messageIdInput ? "GRATZ_MESSAGE_ID_NOT_FOUND" : "GRATZ_MESSAGES_EMPTY",
      );
    }

    return record.text.replaceAll("[user]", `<@${targetUserId}>`);
  }

  async createGratzMessage(text: string): Promise<string> {
    if (!text.trim()) {
      throw new AppError("GRATZ_MESSAGE_TEXT_EMPTY");
    }

    const result = await this.gratzService.createGratzMessage(text);
    return `Поздравление сохранено с id ${result.id}`;
  }

  async getGratzMessage(messageIdInput: string): Promise<string> {
    const messageId = parseMessageId(messageIdInput);
    const record = await this.gratzService.getGratzMessage(messageId);
    if (!record) {
      throw new AppError("GRATZ_MESSAGE_ID_NOT_FOUND");
    }

    return `id ${record.id}\n${record.text}`;
  }

  async deleteGratzMessage(messageIdInput: string): Promise<string> {
    const messageId = parseMessageId(messageIdInput);
    const removed = await this.gratzService.deleteGratzMessage(messageId);
    if (!removed) {
      throw new AppError("GRATZ_MESSAGE_ID_NOT_FOUND");
    }

    return `Поздравление с id ${messageId} удалено`;
  }

  async listGratzMessages(): Promise<string> {
    const records = await this.gratzService.listGratzMessages();
    if (records.length === 0) {
      throw new AppError("GRATZ_MESSAGES_EMPTY");
    }

    return records
      .map((record) => {
        const singleLine = sanitizeMultilinePreview(record.text);
        return `${record.id}. ${trimPreview(singleLine)}`;
      })
      .join("\n");
  }
}
