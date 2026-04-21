import { describe, expect, it, vi } from "vitest";
import type { ChatInputCommandInteraction } from "discord.js";
import { handleKickQueueCommand } from "../src/commands/kick-queue-handler";
import type { KickQueueService } from "../src/members/kick-queue-service";

interface FakeKickQueueInteractionOptions {
  guildId?: string | null;
  inGuild?: boolean;
  subcommand?: "add" | "remove" | "list";
  userId?: string;
  deferred?: boolean;
  replied?: boolean;
}

function createServiceMock(): KickQueueService {
  return {
    listPendingKickUsers: vi.fn().mockResolvedValue([]),
    addPendingKickUser: vi.fn().mockResolvedValue(undefined),
    removePendingKickUser: vi.fn().mockResolvedValue(false),
  } as unknown as KickQueueService;
}

function createFakeInteraction(options: FakeKickQueueInteractionOptions = {}) {
  const reply = vi.fn().mockResolvedValue(undefined);
  const followUp = vi.fn().mockResolvedValue(undefined);

  const interaction = {
    inGuild: () => options.inGuild ?? true,
    guildId: options.guildId ?? "guild-1",
    deferred: options.deferred ?? false,
    replied: options.replied ?? false,
    options: {
      getSubcommand: () => options.subcommand ?? "list",
      getUser: () => ({ id: options.userId ?? "user-1" }),
    },
    reply,
    followUp,
  } as unknown as ChatInputCommandInteraction;

  return { interaction, reply, followUp };
}

describe("handleKickQueueCommand", () => {
  it("rejects non-guild invocation", async () => {
    const service = createServiceMock();
    const { interaction, reply } = createFakeInteraction({
      inGuild: false,
      guildId: null,
    });

    await handleKickQueueCommand(interaction, service);

    expect(reply).toHaveBeenCalledWith({
      content: "Команда доступна только на сервере",
      ephemeral: true,
    });
    expect(service.listPendingKickUsers).not.toHaveBeenCalled();
  });

  it("adds a user to the current guild queue", async () => {
    const service = createServiceMock();
    const { interaction, reply } = createFakeInteraction({
      subcommand: "add",
      userId: "user-77",
    });

    await handleKickQueueCommand(interaction, service);

    expect(service.addPendingKickUser).toHaveBeenCalledWith(
      "guild-1",
      "user-77",
    );
    expect(reply).toHaveBeenCalledWith({
      content: "Пользователь <@user-77> добавлен в очередь на кик",
      ephemeral: true,
    });
  });

  it("renders a per-guild list of users", async () => {
    const service = createServiceMock();
    vi.mocked(service.listPendingKickUsers).mockResolvedValue([
      { guildId: "guild-1", discordUserId: "user-1" },
      { guildId: "guild-1", discordUserId: "user-2" },
    ]);
    const { interaction, reply } = createFakeInteraction({
      subcommand: "list",
    });

    await handleKickQueueCommand(interaction, service);

    expect(service.listPendingKickUsers).toHaveBeenCalledWith("guild-1");
    expect(reply).toHaveBeenCalledWith({
      content: "1. <@user-1> (`user-1`)\n2. <@user-2> (`user-2`)",
      ephemeral: true,
    });
  });

  it("reports when a user is absent from the queue", async () => {
    const service = createServiceMock();
    vi.mocked(service.removePendingKickUser).mockResolvedValue(false);
    const { interaction, reply } = createFakeInteraction({
      subcommand: "remove",
      userId: "user-11",
    });

    await handleKickQueueCommand(interaction, service);

    expect(service.removePendingKickUser).toHaveBeenCalledWith(
      "guild-1",
      "user-11",
    );
    expect(reply).toHaveBeenCalledWith({
      content: "Пользователь <@user-11> не найден в очереди на кик",
      ephemeral: true,
    });
  });
});
