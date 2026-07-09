import { AppError } from "../../utils/errors";
import BirthdayResponse from "./response";
import GratzService from "./services/gratz-service";

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
  constructor(private readonly gratzService: GratzService) {}

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
