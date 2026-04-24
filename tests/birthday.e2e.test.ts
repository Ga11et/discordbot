import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  closeTestDb,
  getTestClient,
  resetBirthdaysTable,
  resetGratzMessagesTable,
  setupTestDb,
} from "./helpers/test-db";
import { createBirthdayService } from "../src/birthdays/service";
import { createGratzService } from "../src/birthdays/gratz-service";
import { BirthdayCommandProcessor } from "../src/birthdays/processor";
import { BirthdayCommandError } from "../src/birthdays/errors";

const ACTOR_ID = "111";
const OTHER_USER_ID = "222";

function createProcessor(): BirthdayCommandProcessor {
  const client = getTestClient();
  const service = createBirthdayService(client);
  const gratz = createGratzService(client);
  return new BirthdayCommandProcessor(service, gratz);
}

describe("BirthdayCommandProcessor (e2e)", () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await resetBirthdaysTable();
    await resetGratzMessagesTable();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("sets birthday for current user and retrieves it via /bd me", async () => {
    const processor = createProcessor();

    const confirmation = await processor.setBirthday(ACTOR_ID, "16.01.1998");
    expect(confirmation).toBe("Дата рождения сохранена!");

    const message = await processor.showOwnBirthday(ACTOR_ID);
    expect(message).toContain("16.01.1998");
  });

  it("allows setting birthday for another user when user argument is provided", async () => {
    const processor = createProcessor();

    const confirmation = await processor.setBirthday(
      ACTOR_ID,
      "24.12.2000",
      OTHER_USER_ID,
    );

    expect(confirmation).toBe(
      `Дата рождения пользователя <@${OTHER_USER_ID}> обновлена!`,
    );

    const selfConfirmation = await processor.setBirthday(
      OTHER_USER_ID,
      "01.01.1990",
    );
    expect(selfConfirmation).toBe("Дата рождения сохранена!");
  });

  it("lets the target user read the birthday set by someone else", async () => {
    const processor = createProcessor();

    await processor.setBirthday(ACTOR_ID, "05.11.1999", OTHER_USER_ID);

    const message = await processor.showOwnBirthday(OTHER_USER_ID);
    expect(message).toContain("05.11.1999");
  });

  it("lists birthdays sorted by calendar order", async () => {
    const processor = createProcessor();

    await processor.setBirthday("u1", "31.12.1995");
    await processor.setBirthday("u2", "01.01.1996");
    await processor.setBirthday("u3", "15.02.1997");

    const list = await processor.listBirthdays();
    expect(list.entries.map((entry) => entry.userId)).toEqual([
      "u2",
      "u3",
      "u1",
    ]);
  });

  it("overwrites an existing birthday and reflects it in the sorted list", async () => {
    const processor = createProcessor();

    await processor.setBirthday("u1", "31.12.1995");
    await processor.setBirthday("u2", "01.01.1996");

    await processor.setBirthday("u1", "15.01.1995");

    const list = await processor.listBirthdays();
    expect(list.entries.map((entry) => entry.userId)).toEqual(["u2", "u1"]);
    expect(list.entries[1].birthdayLabel).toBe("15.01.1995");
  });

  it("rejects malformed dates", async () => {
    const processor = createProcessor();

    await expect(() =>
      processor.setBirthday(ACTOR_ID, "99.99.1999"),
    ).rejects.toBeInstanceOf(BirthdayCommandError);
  });

  it.each(["16-01-1998", "32.01.2000", "15.13.2000", "abc", "29.02.1999"])(
    "rejects invalid date input %s",
    async (dateInput) => {
      const processor = createProcessor();

      await expect(() =>
        processor.setBirthday(ACTOR_ID, dateInput),
      ).rejects.toBeInstanceOf(BirthdayCommandError);
    },
  );

  it("creates and retrieves a gratz message by id", async () => {
    const processor = createProcessor();

    const createResult = await processor.createGratzMessage(
      "С днём рождения! 🎉",
    );
    expect(createResult).toContain("id");

    const idMatch = createResult.match(/(\d+)/);
    expect(idMatch).not.toBeNull();

    const fullMessage = await processor.getGratzMessage(idMatch![1]);
    expect(fullMessage).toContain("С днём рождения! 🎉");
  });

  it("lists gratz messages with preview trimmed to the configured limit", async () => {
    const processor = createProcessor();

    await processor.createGratzMessage(
      "Очень длинное поздравление с переносом\nстроки и дополнительным текстом для проверки обрезки после увеличения лимита preview. Добавляем ещё немного текста, чтобы точно превысить двести символов и убедиться, что в списке появится сокращённая версия сообщения с троеточием в конце.",
    );

    const listMessage = await processor.listGratzMessages();
    expect(listMessage).toMatch(/^\d+\. /);
    expect(listMessage).toContain("...");
    expect(listMessage).not.toContain("\nстроки");
  });

  it("deletes gratz message by id", async () => {
    const processor = createProcessor();

    const createResult = await processor.createGratzMessage(
      "Удаляемое сообщение",
    );
    const id = createResult.match(/(\d+)/)?.[1];
    expect(id).toBeDefined();

    const deleteResult = await processor.deleteGratzMessage(id!);
    expect(deleteResult).toContain("удалено");

    await expect(() => processor.getGratzMessage(id!)).rejects.toBeInstanceOf(
      BirthdayCommandError,
    );
  });

  it("throws domain error when deleting missing gratz id", async () => {
    const processor = createProcessor();

    await expect(() => processor.deleteGratzMessage("999999")).rejects.toThrow(
      "Поздравление с таким id не найдено",
    );
  });

  it("builds public gratz message with mention", async () => {
    const processor = createProcessor();

    await processor.createGratzMessage("[user], желаю счастья и здоровья!");
    const result = await processor.gratzUser(OTHER_USER_ID);

    expect(result).toContain(`<@${OTHER_USER_ID}>,`);
    expect(result).toContain("желаю счастья и здоровья!");
  });

  it("builds public gratz message from the requested message id", async () => {
    const processor = createProcessor();

    await processor.createGratzMessage("[user], случайное поздравление");
    const createResult = await processor.createGratzMessage(
      "[user], поздравляю именно этим сообщением!",
    );
    const messageId = createResult.match(/(\d+)/)?.[1];

    expect(messageId).toBeDefined();

    const result = await processor.gratzUser(OTHER_USER_ID, messageId);

    expect(result).toContain(`<@${OTHER_USER_ID}>,`);
    expect(result).toContain("поздравляю именно этим сообщением!");
    expect(result).not.toContain("случайное поздравление");
  });

  it("fails gratz by specific id when the message does not exist", async () => {
    const processor = createProcessor();

    await processor.createGratzMessage("[user], существующее поздравление");

    await expect(() =>
      processor.gratzUser(OTHER_USER_ID, "999999"),
    ).rejects.toThrow("Поздравление с таким id не найдено");
  });

  it("fails gratz operations when no message templates are stored", async () => {
    const processor = createProcessor();

    await expect(() => processor.gratzUser(OTHER_USER_ID)).rejects.toThrow(
      "Пока нет ни одного поздравления",
    );
    await expect(() => processor.listGratzMessages()).rejects.toThrow(
      "Пока нет ни одного поздравления",
    );
  });
});
