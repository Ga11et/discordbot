import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import testDb from "../helpers/test-db";
import { BirthController } from "../../src/modules/birth/controller";
import { AppError } from "../../src/utils/errors";
import { dateUtils } from "../../src/utils/date-utils";

const ACTOR_ID = "111";
const OTHER_USER_ID = "222";

describe("BirthController (e2e)", () => {
  let controller: BirthController;

  beforeAll(async () => {
    await testDb.init();
    controller = new BirthController(testDb.client());
  });

  beforeEach(async () => {
    await testDb.resetBd();
  });

  afterAll(async () => {
    await testDb.close();
  });

  describe("getOwnBirthday", () => {
    it("returns stored birthday for the current user", async () => {
      await controller.setBirthday(ACTOR_ID, "16.01");
      const record = await controller.getOwnBirthday(ACTOR_ID);

      expect(record.discordUserId).toBe(ACTOR_ID);
      expect(record.birthdayDate.getUTCDate()).toBe(16);
      expect(record.birthdayDate.getUTCMonth()).toBe(0);
    });

    it("returns birthdayDate formatted as dd.mm via dateUtils", async () => {
      await controller.setBirthday(ACTOR_ID, "05.03");
      const record = await controller.getOwnBirthday(ACTOR_ID);

      expect(dateUtils.formatDayMonth(record.birthdayDate)).toBe("05.03");
    });

    it("throws NOT_FOUND when no birthday is stored", async () => {
      await expect(() =>
        controller.getOwnBirthday(ACTOR_ID),
      ).rejects.toSatisfy(
        (e: unknown) => e instanceof AppError && e.code === "NOT_FOUND",
      );
    });
  });

  describe("getBirthday", () => {
    it("returns stored birthday for a given user", async () => {
      await controller.setBirthday(ACTOR_ID, "05.11", OTHER_USER_ID);
      const record = await controller.getBirthday(OTHER_USER_ID);

      expect(record).not.toBeNull();
      expect(record!.discordUserId).toBe(OTHER_USER_ID);
      expect(record!.birthdayDate.getUTCMonth()).toBe(10);
      expect(record!.birthdayDate.getUTCDate()).toBe(5);
    });

    it("returns null when no birthday is stored", async () => {
      const record = await controller.getBirthday(OTHER_USER_ID);
      expect(record).toBeNull();
    });
  });

  describe("setBirthday", () => {
    it("returns type=self when setting own birthday", async () => {
      const result = await controller.setBirthday(ACTOR_ID, "16.01");
      expect(result).toEqual({ type: "self" });
    });

    it("returns type=other with targetUserId when setting another user's birthday", async () => {
      const result = await controller.setBirthday(ACTOR_ID, "24.12", OTHER_USER_ID);
      expect(result).toEqual({ type: "other", targetUserId: OTHER_USER_ID });
    });

    it("overwrites an existing birthday", async () => {
      await controller.setBirthday(ACTOR_ID, "16.01");
      await controller.setBirthday(ACTOR_ID, "05.11");

      const record = await controller.getOwnBirthday(ACTOR_ID);
      expect(record.birthdayDate.getUTCMonth()).toBe(10);
      expect(record.birthdayDate.getUTCDate()).toBe(5);
    });

    it("throws INVALID_FORMAT for wrong date format", async () => {
      await expect(() =>
        controller.setBirthday(ACTOR_ID, "16.01.1998"),
      ).rejects.toSatisfy(
        (e: unknown) => e instanceof AppError && e.code === "INVALID_FORMAT",
      );
    });

    it.each(["32.01", "15.13", "abc", "29.02", "1.1"])(
      "throws AppError for invalid input %s",
      async (dateInput: string) => {
        await expect(() =>
          controller.setBirthday(ACTOR_ID, dateInput),
        ).rejects.toBeInstanceOf(AppError);
      },
    );
  });

  describe("deleteBirthday", () => {
    it("deletes a stored birthday and makes it unretrievable", async () => {
      await controller.setBirthday(ACTOR_ID, "16.01", OTHER_USER_ID);
      const result = await controller.deleteBirthday(OTHER_USER_ID);

      expect(result).toEqual({ targetUserId: OTHER_USER_ID });

      const record = await controller.getBirthday(OTHER_USER_ID);
      expect(record).toBeNull();
    });

    it("throws NOT_FOUND when deleting a birthday that does not exist", async () => {
      await expect(() =>
        controller.deleteBirthday(OTHER_USER_ID),
      ).rejects.toSatisfy(
        (e: unknown) => e instanceof AppError && e.code === "NOT_FOUND",
      );
    });
  });

  describe("listBirthdays", () => {
    it("returns empty array when no birthdays are stored", async () => {
      const entries = await controller.listBirthdays();
      expect(entries).toEqual([]);
    });

    it("returns birthdays sorted by calendar order (month then day)", async () => {
      await controller.setBirthday("u1", "31.12");
      await controller.setBirthday("u2", "01.01");
      await controller.setBirthday("u3", "15.02");

      const entries = await controller.listBirthdays();
      expect(entries.map((e) => e.userId)).toEqual(["u2", "u3", "u1"]);
    });

    it("formats birthdayLabel as dd.mm", async () => {
      await controller.setBirthday(ACTOR_ID, "05.03");
      const entries = await controller.listBirthdays();

      expect(entries[0].birthdayLabel).toBe("05.03");
    });

    it("reflects overwritten birthday in sorted list", async () => {
      await controller.setBirthday("u1", "31.12");
      await controller.setBirthday("u2", "01.01");
      await controller.setBirthday("u1", "15.01");

      const entries = await controller.listBirthdays();
      expect(entries.map((e) => e.userId)).toEqual(["u2", "u1"]);
      expect(entries[1].birthdayLabel).toBe("15.01");
    });
  });
});
