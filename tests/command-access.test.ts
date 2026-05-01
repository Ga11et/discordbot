import { describe, expect, it } from "vitest";
import commandAccess, {
  type SupportedAccessInteraction,
} from "../src/commands/command-access";

const roleConfig = {
  adminRoleIds: ["role-admin"],
  adminUserIds: ["user-admin"],
  testerRoleIds: ["role-tester"],
  testerUserIds: ["user-tester"],
};

const commandIds = [
  "bd.me",
  "bd.set",
  "bd.list",
  "bd.delete",
  "bd.gratz",
  "bd.gratzmessage.create",
  "bd.gratzmessage.get",
  "bd.gratzmessage.delete",
  "bd.gratzmessage.list",
  "kickqueue.check",
  "kickqueue.checkall",
  "kickqueue.add",
  "kickqueue.remove",
  "kickqueue.list",
] as const;

const guestAllowedCommandIds = new Set(["bd.me", "bd.set", "bd.list"]);
const testerAllowedCommandIds = new Set([
  ...guestAllowedCommandIds,
  ...commandAccess.TESTER_ALLOWED_COMMAND_IDS,
]);

const subjects = {
  admin: {
    roleIds: [],
    userId: "user-admin",
  },
  guest: {
    roleIds: [],
    userId: "user-guest",
  },
  tester: {
    roleIds: ["role-tester"],
    userId: "user-guest",
  },
  testerAdmin: {
    roleIds: ["role-tester"],
    userId: "user-admin",
  },
} as const;

const expectedAccess = {
  admin: (commandId: string) => true,
  guest: (commandId: string) => guestAllowedCommandIds.has(commandId),
  tester: (commandId: string) => testerAllowedCommandIds.has(commandId),
  testerAdmin: (commandId: string) => true,
} as const;

const accessConfig = {
  allowedChannelIds: ["channel-1", "channel-2"],
  roleConfig,
};

interface FakeChatInputInteractionOptions {
  channelId?: string | null;
  inGuild?: boolean;
  roleIds?: string[];
  subcommand?: string;
  subcommandGroup?: string | null;
  userId?: string;
}

interface FakeModalInteractionOptions {
  channelId?: string | null;
  customId?: string;
  inGuild?: boolean;
  roleIds?: string[];
  userId?: string;
}

function createChatInputInteraction(
  options: FakeChatInputInteractionOptions = {},
): SupportedAccessInteraction {
  return {
    channelId: options.channelId ?? "channel-1",
    inGuild: () => options.inGuild ?? true,
    isChatInputCommand: () => true,
    isModalSubmit: () => false,
    member: {
      roles: options.roleIds ?? [],
    },
    options: {
      getSubcommand: () => options.subcommand ?? "me",
      getSubcommandGroup: () => options.subcommandGroup ?? false,
    },
    user: {
      id: options.userId ?? "user-guest",
    },
    commandName: "bd",
  } as unknown as SupportedAccessInteraction;
}

function createModalInteraction(
  options: FakeModalInteractionOptions = {},
): SupportedAccessInteraction {
  return {
    channelId: options.channelId ?? "channel-1",
    customId: options.customId ?? "bd:gratzmessage:create",
    inGuild: () => options.inGuild ?? true,
    isChatInputCommand: () => false,
    isModalSubmit: () => true,
    member: {
      roles: options.roleIds ?? [],
    },
    user: {
      id: options.userId ?? "user-guest",
    },
  } as unknown as SupportedAccessInteraction;
}

describe("command access matrix", () => {
  for (const [roleName, subject] of Object.entries(subjects)) {
    for (const commandId of commandIds) {
      it(`allows ${roleName} -> ${commandId} = ${expectedAccess[roleName as keyof typeof expectedAccess](commandId)}`, () => {
        const allowed = commandAccess.hasCommandAccess(
          subject,
          roleConfig,
          commandId,
        );

        expect(allowed).toBe(
          expectedAccess[roleName as keyof typeof expectedAccess](commandId),
        );
      });
    }
  }
});

describe("interaction access", () => {
  it("denies commands outside configured channels before role checks", () => {
    const interaction = createChatInputInteraction({
      channelId: "channel-3",
      roleIds: ["role-tester"],
      subcommand: "gratz",
    });

    expect(
      commandAccess.getInteractionAccessResult(interaction, accessConfig),
    ).toEqual({
      allowed: false,
      commandId: "bd.gratz",
      reason: "CHANNEL_NOT_ALLOWED",
    });
  });

  it("allows public birthday commands for guests in configured channels", () => {
    const interaction = createChatInputInteraction({
      channelId: "channel-2",
      subcommand: "me",
    });

    expect(
      commandAccess.getInteractionAccessResult(interaction, accessConfig),
    ).toEqual({
      allowed: true,
      commandId: "bd.me",
      reason: null,
    });
  });

  it("denies restricted birthday commands for guests in configured channels", () => {
    const interaction = createChatInputInteraction({
      channelId: "channel-1",
      subcommand: "delete",
    });

    expect(
      commandAccess.getInteractionAccessResult(interaction, accessConfig),
    ).toEqual({
      allowed: false,
      commandId: "bd.delete",
      reason: "ROLE_NOT_ALLOWED",
    });
  });

  it("parses modal custom ids in the centralized access flow", () => {
    const interaction = createModalInteraction({
      roleIds: ["role-tester"],
    });

    expect(
      commandAccess.getInteractionAccessResult(interaction, accessConfig),
    ).toEqual({
      allowed: false,
      commandId: "bd.gratzmessage.create",
      reason: "ROLE_NOT_ALLOWED",
    });
  });

  it("builds public denial messages without the privileged-users suffix", () => {
    expect(
      commandAccess.getAccessDeniedMessage("bd", accessConfig, {
        allowed: false,
        commandId: "bd.me",
        reason: "CHANNEL_NOT_ALLOWED",
      }),
    ).toBe("Команды /bd доступны только в каналах: <#channel-1>, <#channel-2>");
  });

  it("builds restricted denial messages with the privileged-users suffix", () => {
    expect(
      commandAccess.getAccessDeniedMessage("kickqueue", accessConfig, {
        allowed: false,
        commandId: "kickqueue.remove",
        reason: "ROLE_NOT_ALLOWED",
      }),
    ).toBe(
      "Команды /kickqueue доступны только в каналах: <#channel-1>, <#channel-2> и пользователям с правами TESTER или ADMIN",
    );
  });
});
