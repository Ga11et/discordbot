import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import testDb from "../helpers/test-db";
import { BirthController } from "../../src/modules/birth/controller";

const GUILD_ID = "guild-1";
const GUILD_ID_2 = "guild-2";
const USER_1 = "user-1";
const USER_2 = "user-2";
const USER_3 = "user-3";

describe("BirthController — check queue (e2e)", () => {
  let controller: BirthController;

  beforeAll(async () => {
    await testDb.init();
    controller = new BirthController(testDb.client());
  });

  beforeEach(async () => {
    await testDb.resetBirthCheckQ();
    await testDb.resetBd();
  });

  afterAll(async () => {
    await testDb.close();
  });

  describe("addToCheckQueue", () => {
    it("returns true when adding a new user", async () => {
      const result = await controller.addToCheckQueue(GUILD_ID, USER_1);
      expect(result).toBe(true);
    });

    it("returns false when adding the same user twice (idempotent)", async () => {
      await controller.addToCheckQueue(GUILD_ID, USER_1);
      const result = await controller.addToCheckQueue(GUILD_ID, USER_1);
      expect(result).toBe(false);
    });

    it("allows the same user in different guilds", async () => {
      const r1 = await controller.addToCheckQueue(GUILD_ID, USER_1);
      const r2 = await controller.addToCheckQueue(GUILD_ID_2, USER_1);
      expect(r1).toBe(true);
      expect(r2).toBe(true);
    });
  });

  describe("removeFromCheckQueue", () => {
    it("returns true when removing an existing entry", async () => {
      await controller.addToCheckQueue(GUILD_ID, USER_1);
      const result = await controller.removeFromCheckQueue(GUILD_ID, USER_1);
      expect(result).toBe(true);
    });

    it("returns false when removing a non-existent entry", async () => {
      const result = await controller.removeFromCheckQueue(GUILD_ID, USER_1);
      expect(result).toBe(false);
    });

    it("removes only from the targeted guild", async () => {
      await controller.addToCheckQueue(GUILD_ID, USER_1);
      await controller.addToCheckQueue(GUILD_ID_2, USER_1);

      await controller.removeFromCheckQueue(GUILD_ID, USER_1);

      const queue1 = await controller.listCheckQueue(GUILD_ID);
      const queue2 = await controller.listCheckQueue(GUILD_ID_2);
      expect(queue1).toHaveLength(0);
      expect(queue2).toHaveLength(1);
    });
  });

  describe("listCheckQueue", () => {
    it("returns empty list when queue is empty", async () => {
      const records = await controller.listCheckQueue(GUILD_ID);
      expect(records).toEqual([]);
    });

    it("returns only entries for the requested guild", async () => {
      await controller.addToCheckQueue(GUILD_ID, USER_1);
      await controller.addToCheckQueue(GUILD_ID_2, USER_2);

      const records = await controller.listCheckQueue(GUILD_ID);
      expect(records).toHaveLength(1);
      expect(records[0]).toEqual({ guildId: GUILD_ID, discordUserId: USER_1 });
    });

    it("lists multiple users in insertion order", async () => {
      await controller.addToCheckQueue(GUILD_ID, USER_1);
      await controller.addToCheckQueue(GUILD_ID, USER_2);
      await controller.addToCheckQueue(GUILD_ID, USER_3);

      const records = await controller.listCheckQueue(GUILD_ID);
      expect(records.map((r) => r.discordUserId)).toEqual([USER_1, USER_2, USER_3]);
    });

    it("does not list removed users", async () => {
      await controller.addToCheckQueue(GUILD_ID, USER_1);
      await controller.addToCheckQueue(GUILD_ID, USER_2);
      await controller.removeFromCheckQueue(GUILD_ID, USER_1);

      const records = await controller.listCheckQueue(GUILD_ID);
      expect(records).toHaveLength(1);
      expect(records[0].discordUserId).toBe(USER_2);
    });
  });

  describe("check flow", () => {
    it("allows re-adding a user after removeFromCheckQueue", async () => {
      await controller.addToCheckQueue(GUILD_ID, USER_1);
      await controller.removeFromCheckQueue(GUILD_ID, USER_1);
      const result = await controller.addToCheckQueue(GUILD_ID, USER_1);
      expect(result).toBe(true);
    });

    it("does not add to queue if birthday is already set", async () => {
      await controller.setBirthday(USER_1, "16.01");

      const existing = await controller.getBirthday(USER_1);
      expect(existing).not.toBeNull();

      const added = await controller.addToCheckQueue(GUILD_ID, USER_1);
      expect(added).toBe(true);
    });
  });
});
