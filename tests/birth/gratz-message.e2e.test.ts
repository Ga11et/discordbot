import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import testDb from "../helpers/test-db";
import { GratzMessageController } from "../../src/modules/birth/gratz-message/controller";
import { AppError } from "../../src/utils/errors";

const TARGET_ID = "user-1";
const OTHER_TARGET_ID = "user-2";

describe("GratzMessageController (e2e)", () => {
  let controller: GratzMessageController;

  beforeAll(async () => {
    await testDb.init();
    controller = new GratzMessageController(testDb.client());
  });

  beforeEach(async () => {
    await testDb.resetGratz();
  });

  afterAll(async () => {
    await testDb.close();
  });

  describe("createGratzMessage", () => {
    it("saves a message and returns a record with a positive id", async () => {
      const record = await controller.createGratzMessage("С днём рождения! 🎉");

      expect(record.id).toBeGreaterThan(0);
      expect(record.text).toBe("С днём рождения! 🎉");
    });

    it("throws EMPTY_VALUE when text is blank", async () => {
      await expect(() =>
        controller.createGratzMessage("   "),
      ).rejects.toSatisfy(
        (e: unknown) => e instanceof AppError && e.code === "EMPTY_VALUE",
      );
    });
  });

  describe("getGratzMessage", () => {
    it("returns the stored record by id", async () => {
      const created = await controller.createGratzMessage("Тестовое поздравление");
      const found = await controller.getGratzMessage(String(created.id));

      expect(found.id).toBe(created.id);
      expect(found.text).toBe("Тестовое поздравление");
    });

    it("throws NOT_FOUND for an unknown id", async () => {
      await expect(() =>
        controller.getGratzMessage("999999"),
      ).rejects.toSatisfy(
        (e: unknown) => e instanceof AppError && e.code === "NOT_FOUND",
      );
    });

    it("throws INVALID_INPUT for a non-numeric id", async () => {
      await expect(() =>
        controller.getGratzMessage("abc"),
      ).rejects.toSatisfy(
        (e: unknown) => e instanceof AppError && e.code === "INVALID_INPUT",
      );
    });
  });

  describe("deleteGratzMessage", () => {
    it("deletes an existing record and returns it", async () => {
      const created = await controller.createGratzMessage("Удаляемое поздравление");
      const deleted = await controller.deleteGratzMessage(String(created.id));

      expect(deleted.id).toBe(created.id);
      await expect(() =>
        controller.getGratzMessage(String(created.id)),
      ).rejects.toSatisfy(
        (e: unknown) => e instanceof AppError && e.code === "NOT_FOUND",
      );
    });

    it("throws NOT_FOUND when deleting an unknown id", async () => {
      await expect(() =>
        controller.deleteGratzMessage("999999"),
      ).rejects.toSatisfy(
        (e: unknown) => e instanceof AppError && e.code === "NOT_FOUND",
      );
    });
  });

  describe("listGratzMessages", () => {
    it("returns all stored messages ordered by id", async () => {
      const a = await controller.createGratzMessage("Первое");
      const b = await controller.createGratzMessage("Второе");

      const list = await controller.listGratzMessages();

      expect(list).toHaveLength(2);
      expect(list[0].id).toBe(a.id);
      expect(list[1].id).toBe(b.id);
    });

    it("throws NOT_FOUND when no messages exist", async () => {
      await expect(() =>
        controller.listGratzMessages(),
      ).rejects.toSatisfy(
        (e: unknown) => e instanceof AppError && e.code === "NOT_FOUND",
      );
    });
  });

  describe("gratzUser", () => {
    it("replaces [user] with a mention and returns the message", async () => {
      await controller.createGratzMessage("[user], с днём рождения!");
      const result = await controller.gratzUser(TARGET_ID);

      expect(result).toBe(`<@${TARGET_ID}>, с днём рождения!`);
    });

    it("uses the specified message id when provided", async () => {
      await controller.createGratzMessage("[user], случайное поздравление");
      const specific = await controller.createGratzMessage("[user], конкретное поздравление");

      const result = await controller.gratzUser(OTHER_TARGET_ID, String(specific.id));

      expect(result).toContain("конкретное поздравление");
      expect(result).not.toContain("случайное поздравление");
    });

    it("throws NOT_FOUND when no messages exist", async () => {
      await expect(() =>
        controller.gratzUser(TARGET_ID),
      ).rejects.toSatisfy(
        (e: unknown) => e instanceof AppError && e.code === "NOT_FOUND",
      );
    });

    it("throws NOT_FOUND when specified message id does not exist", async () => {
      await controller.createGratzMessage("[user], существующее поздравление");

      await expect(() =>
        controller.gratzUser(TARGET_ID, "999999"),
      ).rejects.toSatisfy(
        (e: unknown) => e instanceof AppError && e.code === "NOT_FOUND",
      );
    });
  });
});
