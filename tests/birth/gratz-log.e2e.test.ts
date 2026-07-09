import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import testDb from "../helpers/test-db";
import { BirthdayGratzLogController } from "../../src/modules/birth/gratz-log/controller";
import { AppError } from "../../src/utils/errors";

const GUILD_ID = "guild-1";
const ACTOR_ID = "actor-1";
const OTHER_ACTOR_ID = "actor-2";
const TARGET_ID = "target-1";
const OTHER_TARGET_ID = "target-2";

describe("BirthdayGratzLogController (e2e)", () => {
  let controller: BirthdayGratzLogController;

  beforeAll(async () => {
    await testDb.init();
    controller = new BirthdayGratzLogController(testDb.client());
  });

  beforeEach(async () => {
    await testDb.resetGratzLog();
  });

  afterAll(async () => {
    await testDb.close();
  });

  describe("createLog", () => {
    it("creates a log entry", async () => {
      await controller.createLog(GUILD_ID, ACTOR_ID, TARGET_ID);

      const logs = await controller.listRecent(TARGET_ID, 10);
      expect(logs).toHaveLength(1);
      expect(logs[0].guildId).toBe(GUILD_ID);
      expect(logs[0].actorId).toBe(ACTOR_ID);
      expect(logs[0].targetUserId).toBe(TARGET_ID);
      expect(logs[0].createdAt).toBeInstanceOf(Date);
    });
  });

  describe("listRecent", () => {
    it("returns empty array when no logs are stored", async () => {
      const logs = await controller.listRecent(TARGET_ID, 10);
      expect(logs).toEqual([]);
    });

    it("lists recent entries without a target filter", async () => {
      await controller.createLog(GUILD_ID, ACTOR_ID, TARGET_ID);
      await controller.createLog(GUILD_ID, ACTOR_ID, OTHER_TARGET_ID);
      await controller.createLog(GUILD_ID, OTHER_ACTOR_ID, TARGET_ID);

      const logs = await controller.listRecent(undefined, 10);

      expect(logs).toHaveLength(3);
      expect(logs[0].targetUserId).toBe(TARGET_ID);
      expect(logs[1].targetUserId).toBe(OTHER_TARGET_ID);
      expect(logs[2].targetUserId).toBe(TARGET_ID);
    });

    it("lists recent entries filtered by target user", async () => {
      await controller.createLog(GUILD_ID, ACTOR_ID, TARGET_ID);
      await controller.createLog(GUILD_ID, ACTOR_ID, OTHER_TARGET_ID);

      const logs = await controller.listRecent(TARGET_ID, 10);

      expect(logs).toHaveLength(1);
      expect(logs[0].targetUserId).toBe(TARGET_ID);
    });

    it("respects the limit when listing", async () => {
      for (let i = 0; i < 5; i += 1) {
        await controller.createLog(GUILD_ID, ACTOR_ID, TARGET_ID);
      }

      const logs = await controller.listRecent(undefined, 3);

      expect(logs).toHaveLength(3);
    });
  });

  describe("deleteMostRecentByTarget", () => {
    it("deletes the most recent entry for a target", async () => {
      await controller.createLog(GUILD_ID, ACTOR_ID, TARGET_ID);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await controller.createLog(GUILD_ID, OTHER_ACTOR_ID, TARGET_ID);

      const result = await controller.deleteMostRecentByTarget(TARGET_ID);

      expect(result).toEqual({ targetUserId: TARGET_ID });
      const logs = await controller.listRecent(TARGET_ID, 10);
      expect(logs).toHaveLength(1);
      expect(logs[0].actorId).toBe(ACTOR_ID);
    });

    it("throws NOT_FOUND when deleting a target without log entries", async () => {
      await expect(() =>
        controller.deleteMostRecentByTarget(TARGET_ID),
      ).rejects.toSatisfy(
        (e: unknown) => e instanceof AppError && e.code === "NOT_FOUND",
      );
    });
  });

  describe("hasRecentGreeting", () => {
    it("returns false when no logs exist for the target", async () => {
      const hasRecent = await controller.hasRecentGreeting(TARGET_ID);

      expect(hasRecent).toBe(false);
    });

    it("detects a recent greeting within the last 6 months", async () => {
      await controller.createLog(GUILD_ID, ACTOR_ID, TARGET_ID);

      const hasRecent = await controller.hasRecentGreeting(TARGET_ID);

      expect(hasRecent).toBe(true);
    });

    it("does not detect a recent greeting older than 6 months", async () => {
      const client = testDb.client();
      const oldDate = new Date(Date.now() - 7 * 30 * 24 * 60 * 60 * 1000);
      await client("birthday_gratz_log").insert({
        guild_id: GUILD_ID,
        actor_id: ACTOR_ID,
        target_user_id: TARGET_ID,
        created_at: oldDate,
      });

      const hasRecent = await controller.hasRecentGreeting(TARGET_ID);

      expect(hasRecent).toBe(false);
    });
  });
});
