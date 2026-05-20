import { AppError } from "../../utils/errors";
import DateUtils from "../../utils/date-utils";
import BirthdayResponse from "./response";
import BirthdayService from "./services/birthday-service";
import GratzService from "./services/gratz-service";

export interface ListEntry {
  userId: string;
  birthdayLabel: string;
}

export interface ListResult {
  entries: ListEntry[];
}

const dateUtils = new DateUtils();
const birthdayResponse = new BirthdayResponse();

function parseMessageId(input: string): number {
  const parsed = Number(input);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(
      "INVALID_INPUT",
      birthdayResponse.buildMessageIdInvalidError(),
    );
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
      throw new AppError(
        "NOT_FOUND",
        birthdayResponse.buildBirthdayNotFoundResponse(),
      );
    }

    return birthdayResponse.buildOwnBirthdayResponse(record.birthdayDate);
  }

  async setBirthday(
    actorId: string,
    dateInput: string,
    targetUserId?: string,
  ): Promise<string> {
    let parsed: Date;
    try {
      parsed = dateUtils.parseDateInput(dateInput);
    } catch (error) {
      if (error instanceof AppError) {
        if (error.code === "INVALID_FORMAT") {
          throw new AppError(
            "INVALID_FORMAT",
            birthdayResponse.buildDateInputFormatError(),
          );
        }

        if (error.code === "INVALID_DATE") {
          throw new AppError(
            "INVALID_DATE",
            birthdayResponse.buildDateInvalidError(),
          );
        }

        if (error.code === "FUTURE_DATE") {
          throw new AppError(
            "FUTURE_DATE",
            birthdayResponse.buildDateFromFutureError(),
          );
        }
      }

      throw error;
    }

    const userIdToUpdate = targetUserId ?? actorId;

    await this.birthdayService.upsertBirthday(userIdToUpdate, parsed);

    if (userIdToUpdate === actorId) {
      return birthdayResponse.buildBirthdaySavedResponse();
    }

    return birthdayResponse.buildBirthdayUpdatedResponse(userIdToUpdate);
  }

  async deleteBirthday(targetUserId: string): Promise<string> {
    const removed = await this.birthdayService.deleteBirthday(targetUserId);
    if (!removed) {
      throw new AppError(
        "NOT_FOUND",
        birthdayResponse.buildBirthdayForUserNotFoundResponse(targetUserId),
      );
    }

    return birthdayResponse.buildBirthdayDeletedResponse(targetUserId);
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
        "NOT_FOUND",
        messageIdInput
          ? birthdayResponse.buildGratzMessageNotFoundError()
          : birthdayResponse.buildGratzMessagesEmptyError(),
      );
    }

    return record.text.replaceAll("[user]", `<@${targetUserId}>`);
  }

  async createGratzMessage(text: string): Promise<string> {
    if (!text.trim()) {
      throw new AppError(
        "EMPTY_VALUE",
        birthdayResponse.buildGratzMessageTextEmptyError(),
      );
    }

    const result = await this.gratzService.createGratzMessage(text);
    return birthdayResponse.buildGratzMessageSavedResponse(result.id);
  }

  async getGratzMessage(messageIdInput: string): Promise<string> {
    const messageId = parseMessageId(messageIdInput);
    const record = await this.gratzService.getGratzMessage(messageId);
    if (!record) {
      throw new AppError(
        "NOT_FOUND",
        birthdayResponse.buildGratzMessageNotFoundError(),
      );
    }

    return birthdayResponse.buildGratzMessageByIdResponse(record);
  }

  async deleteGratzMessage(messageIdInput: string): Promise<string> {
    const messageId = parseMessageId(messageIdInput);
    const removed = await this.gratzService.deleteGratzMessage(messageId);
    if (!removed) {
      throw new AppError(
        "NOT_FOUND",
        birthdayResponse.buildGratzMessageNotFoundError(),
      );
    }

    return birthdayResponse.buildGratzMessageDeletedResponse(messageId);
  }

  async listGratzMessages(): Promise<string> {
    const records = await this.gratzService.listGratzMessages();
    if (records.length === 0) {
      throw new AppError(
        "NOT_FOUND",
        birthdayResponse.buildGratzMessagesEmptyError(),
      );
    }

    return birthdayResponse.buildGratzMessagesListResponse(records);
  }
}
