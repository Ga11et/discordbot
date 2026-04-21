import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createKickQueueService } from "../src/members/kick-queue-service";
import {
  closeTestDb,
  getTestClient,
  resetKickQueueTable,
  setupTestDb,
} from "./helpers/test-db";

describe("KickQueueService (e2e)", () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await resetKickQueueTable();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("adds and lists users only for the requested guild", async () => {
    const service = createKickQueueService(getTestClient());

    await service.addPendingKickUser("guild-1", "user-1");
    await service.addPendingKickUser("guild-2", "user-2");

    await expect(service.listPendingKickUsers("guild-1")).resolves.toEqual([
      {
        guildId: "guild-1",
        discordUserId: "user-1",
      },
    ]);
  });

  it("keeps add idempotent within the same guild", async () => {
    const service = createKickQueueService(getTestClient());

    await service.addPendingKickUser("guild-1", "user-1");
    await service.addPendingKickUser("guild-1", "user-1");

    const records = await service.listPendingKickUsers("guild-1");
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual({
      guildId: "guild-1",
      discordUserId: "user-1",
    });
  });

  it("allows the same user to be queued in multiple guilds", async () => {
    const service = createKickQueueService(getTestClient());

    await service.addPendingKickUser("guild-1", "user-1");
    await service.addPendingKickUser("guild-2", "user-1");

    await expect(service.listPendingKickUsers("guild-1")).resolves.toEqual([
      {
        guildId: "guild-1",
        discordUserId: "user-1",
      },
    ]);
    await expect(service.listPendingKickUsers("guild-2")).resolves.toEqual([
      {
        guildId: "guild-2",
        discordUserId: "user-1",
      },
    ]);
  });

  it("removes a user only from the targeted guild", async () => {
    const service = createKickQueueService(getTestClient());

    await service.addPendingKickUser("guild-1", "user-1");
    await service.addPendingKickUser("guild-2", "user-1");

    await expect(
      service.removePendingKickUser("guild-1", "user-1"),
    ).resolves.toBe(true);
    await expect(service.listPendingKickUsers("guild-1")).resolves.toEqual([]);
    await expect(service.listPendingKickUsers("guild-2")).resolves.toEqual([
      {
        guildId: "guild-2",
        discordUserId: "user-1",
      },
    ]);
  });

  it("returns false when removing a missing user", async () => {
    const service = createKickQueueService(getTestClient());

    await expect(
      service.removePendingKickUser("guild-1", "missing-user"),
    ).resolves.toBe(false);
  });
});
