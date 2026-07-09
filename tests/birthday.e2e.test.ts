import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import testDb from "./helpers/test-db";
import GratzService from "../src/modules/birthdays/services/gratz-service";
import { BirthdayCommandProcessor } from "../src/modules/birthdays/processor";
import { AppError } from "../src/utils/errors";

const OTHER_USER_ID = "222";

function createProcessor(): BirthdayCommandProcessor {
  const client = testDb.client();
  const gratzService = new GratzService(client);
  return new BirthdayCommandProcessor(gratzService);
}

describe("BirthdayCommandProcessor (e2e)", () => {
  beforeAll(async () => {
    await testDb.init();
  });

  beforeEach(async () => {
    await testDb.resetGratz();
    await testDb.resetGratzLog();
  });

  afterAll(async () => {
    await testDb.close();
  });

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

  it("returns the same gratz message id that is stored in the database", async () => {
    const processor = createProcessor();
    const client = testDb.client();

    const createResult = await processor.createGratzMessage(
      "Проверка совпадения id сообщения",
    );
    const returnedId = Number(createResult.match(/(\d+)/)?.[1]);

    expect(returnedId).toBeGreaterThan(0);

    const row = await client("birthday_gratz_messages")
      .select("id")
      .where("message_text", "Проверка совпадения id сообщения")
      .first<{ id: number }>();

    expect(row).toBeDefined();
    expect(Number(row?.id)).toBe(returnedId);
  });

  it("keeps gratz message ids correct after deleting the last message and creating a new one", async () => {
    const processor = createProcessor();
    const client = testDb.client();

    const firstText = "Первое сообщение для проверки id";
    const secondText = "Второе сообщение для проверки id";
    const thirdText = "Третье сообщение для проверки id";
    const fourthText = "Новое сообщение после удаления последнего";

    const firstId = Number(
      (await processor.createGratzMessage(firstText)).match(/(\d+)/)?.[1],
    );
    const secondId = Number(
      (await processor.createGratzMessage(secondText)).match(/(\d+)/)?.[1],
    );
    const thirdId = Number(
      (await processor.createGratzMessage(thirdText)).match(/(\d+)/)?.[1],
    );

    const rowsAfterCreate = await client("birthday_gratz_messages")
      .select("id", "message_text")
      .orderBy("id", "asc");

    expect(rowsAfterCreate).toHaveLength(3);
    expect(rowsAfterCreate.map((row) => Number(row.id))).toEqual([
      firstId,
      secondId,
      thirdId,
    ]);
    expect(rowsAfterCreate.map((row) => row.message_text)).toEqual([
      firstText,
      secondText,
      thirdText,
    ]);

    await processor.deleteGratzMessage(String(thirdId));

    const rowsAfterDelete = await client("birthday_gratz_messages")
      .select("id", "message_text")
      .orderBy("id", "asc");

    expect(rowsAfterDelete).toHaveLength(2);
    expect(rowsAfterDelete.map((row) => Number(row.id))).toEqual([
      firstId,
      secondId,
    ]);
    expect(rowsAfterDelete.map((row) => row.message_text)).toEqual([
      firstText,
      secondText,
    ]);

    const fourthId = Number(
      (await processor.createGratzMessage(fourthText)).match(/(\d+)/)?.[1],
    );

    const finalRows = await client("birthday_gratz_messages")
      .select("id", "message_text")
      .orderBy("id", "asc");

    expect(finalRows).toHaveLength(3);
    expect(finalRows.map((row) => Number(row.id))).toEqual([
      firstId,
      secondId,
      fourthId,
    ]);
    expect(finalRows.map((row) => row.message_text)).toEqual([
      firstText,
      secondText,
      fourthText,
    ]);
    expect(fourthId).toBeGreaterThan(thirdId);
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
      AppError,
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
