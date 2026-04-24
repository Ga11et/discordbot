import { MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import { describe, expect, it, vi } from "vitest";
import kickQueueAccess from "../src/commands/kick-queue-access";
import type { CommandAccessConfig } from "../src/commands/command-access";

interface FakeInteractionOptions {
  channelId?: string | null;
  deferred?: boolean;
  inGuild?: boolean;
  replied?: boolean;
  roleIds?: string[];
  subcommand?: string;
  userId?: string;
}

function createFakeInteraction(options: FakeInteractionOptions = {}) {
  const reply = vi.fn().mockResolvedValue(undefined);
  const followUp = vi.fn().mockResolvedValue(undefined);

  const interaction = {
    channelId: options.channelId ?? "channel-1",
    commandName: "kickqueue",
    deferred: options.deferred ?? false,
    followUp,
    inGuild: () => options.inGuild ?? true,
    isChatInputCommand: () => true,
    isModalSubmit: () => false,
    member: {
      roles: options.roleIds ?? [],
    },
    options: {
      getSubcommand: () => options.subcommand ?? "remove",
      getSubcommandGroup: () => false,
    },
    replied: options.replied ?? false,
    reply,
    user: {
      id: options.userId ?? "user-guest",
    },
  } as unknown as ChatInputCommandInteraction;

  return { followUp, interaction, reply };
}

const accessConfig: CommandAccessConfig = {
  allowedChannelIds: ["channel-1"],
  roleConfig: {
    adminRoleIds: ["role-admin"],
    adminUserIds: ["user-admin"],
    testerRoleIds: ["role-tester"],
    testerUserIds: ["user-tester"],
  },
};

describe("kickqueue access wrapper", () => {
  it("allows interaction without replying when centralized access allows it", async () => {
    const { followUp, interaction, reply } = createFakeInteraction({
      roleIds: ["role-tester"],
    });

    const allowed = await kickQueueAccess.ensureAccess(
      interaction,
      accessConfig,
    );

    expect(allowed).toBe(true);
    expect(reply).not.toHaveBeenCalled();
    expect(followUp).not.toHaveBeenCalled();
  });

  it("denies interaction with an ephemeral flags reply when centralized access denies it", async () => {
    const { interaction, reply } = createFakeInteraction({
      channelId: "channel-2",
      roleIds: ["role-tester"],
    });

    const allowed = await kickQueueAccess.ensureAccess(
      interaction,
      accessConfig,
    );

    expect(allowed).toBe(false);
    expect(reply).toHaveBeenCalledWith({
      content:
        "Команды /kickqueue доступны только в канале <#channel-1> и пользователям с правами TESTER или ADMIN",
      flags: MessageFlags.Ephemeral,
    });
  });

  it("uses followUp instead of reply when denied interaction already has a response", async () => {
    const { followUp, interaction, reply } = createFakeInteraction({
      channelId: "channel-2",
      replied: true,
      roleIds: ["role-tester"],
    });

    const allowed = await kickQueueAccess.ensureAccess(
      interaction,
      accessConfig,
    );

    expect(allowed).toBe(false);
    expect(reply).not.toHaveBeenCalled();
    expect(followUp).toHaveBeenCalledWith({
      content:
        "Команды /kickqueue доступны только в канале <#channel-1> и пользователям с правами TESTER или ADMIN",
      flags: MessageFlags.Ephemeral,
    });
  });
});
