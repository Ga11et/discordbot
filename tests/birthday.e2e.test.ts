import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  closeTestDb,
  getTestClient,
  resetBirthdaysTable,
  setupTestDb,
} from "./helpers/test-db";
import { createBirthdayService } from "../src/birthdays/service";
import { BirthdayCommandProcessor } from "../src/birthdays/processor";
import { BirthdayCommandError } from "../src/birthdays/errors";

const ACTOR_ID = "111";
const OTHER_USER_ID = "222";

function createProcessor(): BirthdayCommandProcessor {
  const service = createBirthdayService(getTestClient());
  return new BirthdayCommandProcessor(service);
}

describe("BirthdayCommandProcessor (e2e)", () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await resetBirthdaysTable();
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
});
