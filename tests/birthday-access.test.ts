import { describe, expect, it, vi } from "vitest";
import type { ChatInputCommandInteraction } from "discord.js";
import birthdayAccess from "../src/commands/birthday-access";
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
    commandName: "bd",
    deferred: options.deferred ?? false,
    followUp,
    inGuild: () => options.inGuild ?? true,
    isChatInputCommand: () => true,
    isModalSubmit: () => false,
    member: {
      roles: options.roleIds ?? [],
    },
    options: {
      getSubcommand: () => options.subcommand ?? "gratz",
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
  allowedChannelIds: ["channel-1", "channel-2"],
  roleConfig: {
    adminRoleIds: ["role-admin"],
    adminUserIds: ["user-admin"],
    testerRoleIds: ["role-tester"],
    testerUserIds: ["user-tester"],
  },
};

describe("birthday access wrapper", () => {
  it("denies interaction when centralized access denies it", async () => {
    const { followUp, interaction, reply } = createFakeInteraction({
      roleIds: ["role-tester"],
    });

    const allowed = await birthdayAccess.ensureAccess(
      interaction,
      accessConfig,
    );

    expect(allowed).toBe(false);
  });

  it("denies interaction with an ephemeral reply when centralized access denies it", async () => {
    const { interaction, reply } = createFakeInteraction({
      channelId: "channel-3",
      roleIds: ["role-tester"],
    });

    const allowed = await birthdayAccess.ensureAccess(
      interaction,
      accessConfig,
    );

    expect(allowed).toBe(false);
    expect(reply).toHaveBeenCalledWith({
      content:
        "Команды /bd доступны только в каналах: <#channel-1>, <#channel-2> и пользователям с правами TESTER или ADMIN",
      ephemeral: true,
    });
  });

  it("uses followUp instead of reply when denied interaction already has a response", async () => {
    const { followUp, interaction, reply } = createFakeInteraction({
      channelId: "channel-3",
      replied: true,
      roleIds: ["role-tester"],
    });

    const allowed = await birthdayAccess.ensureAccess(
      interaction,
      accessConfig,
    );

    expect(allowed).toBe(false);
    expect(reply).not.toHaveBeenCalled();
    expect(followUp).toHaveBeenCalledWith({
      content:
        "Команды /bd доступны только в каналах: <#channel-1>, <#channel-2> и пользователям с правами TESTER или ADMIN",
      ephemeral: true,
    });
  });
});
