import { describe, expect, it, vi } from "vitest";
import type {
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
} from "discord.js";
import {
  ensureBirthdayAccess,
  hasBirthdayAccess,
  isPublicBirthdaySubcommand,
  loadBirthdayAccessConfig,
  type BirthdayAccessConfig,
} from "../src/commands/birthday-access";

interface FakeInteractionOptions {
  inGuild?: boolean;
  channelId?: string;
  roleIds?: string[];
  subcommand?: string;
  subcommandGroup?: string | null;
  deferred?: boolean;
  replied?: boolean;
}

function createFakeChatInteraction(options: FakeInteractionOptions = {}) {
  const reply = vi.fn().mockResolvedValue(undefined);
  const followUp = vi.fn().mockResolvedValue(undefined);

  const interaction = {
    inGuild: () => options.inGuild ?? true,
    channelId: options.channelId ?? "channel-1",
    member: options.roleIds ? { roles: options.roleIds } : null,
    options: {
      getSubcommand: () => options.subcommand ?? "me",
      getSubcommandGroup: () => options.subcommandGroup ?? null,
    },
    deferred: options.deferred ?? false,
    replied: options.replied ?? false,
    reply,
    followUp,
  } as unknown as ChatInputCommandInteraction;

  return { interaction, reply, followUp };
}

function createFakeModalInteractionWithRoleCache(
  roleIds: string[],
): ModalSubmitInteraction {
  return {
    inGuild: () => true,
    channelId: "channel-1",
    member: {
      roles: {
        cache: new Map(roleIds.map((id) => [id, {}])),
      },
    },
    deferred: false,
    replied: false,
    reply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
  } as unknown as ModalSubmitInteraction;
}

const accessConfig: BirthdayAccessConfig = {
  allowedChannelId: "channel-1",
  allowedRoleIds: ["role-a", "role-b"],
};

describe("loadBirthdayAccessConfig", () => {
  it("parses channel id and list of role ids", () => {
    const config = loadBirthdayAccessConfig({
      BD_ALLOWED_CHANNEL_ID: "  channel-1  ",
      BD_ALLOWED_ROLE_IDS: " role-a, role-b,role-a ,, ",
    });

    expect(config).toEqual({
      allowedChannelId: "channel-1",
      allowedRoleIds: ["role-a", "role-b"],
    });
  });

  it("throws when channel id is missing", () => {
    expect(() =>
      loadBirthdayAccessConfig({ BD_ALLOWED_ROLE_IDS: "role-a" }),
    ).toThrow("BD_ALLOWED_CHANNEL_ID is not set");
  });

  it("throws when role ids are missing or empty", () => {
    expect(() =>
      loadBirthdayAccessConfig({ BD_ALLOWED_CHANNEL_ID: "channel-1" }),
    ).toThrow("BD_ALLOWED_ROLE_IDS is not set");

    expect(() =>
      loadBirthdayAccessConfig({
        BD_ALLOWED_CHANNEL_ID: "channel-1",
        BD_ALLOWED_ROLE_IDS: " , , ",
      }),
    ).toThrow("BD_ALLOWED_ROLE_IDS must contain at least one role id");
  });
});

describe("birthday access checks", () => {
  it("marks top-level me/set/list as public subcommands", () => {
    const me = createFakeChatInteraction({ subcommand: "me" }).interaction;
    const set = createFakeChatInteraction({ subcommand: "set" }).interaction;
    const list = createFakeChatInteraction({ subcommand: "list" }).interaction;

    expect(isPublicBirthdaySubcommand(me)).toBe(true);
    expect(isPublicBirthdaySubcommand(set)).toBe(true);
    expect(isPublicBirthdaySubcommand(list)).toBe(true);
  });

  it("does not mark restricted /bd subcommands as public", () => {
    const del = createFakeChatInteraction({
      subcommand: "delete",
    }).interaction;
    const gratz = createFakeChatInteraction({
      subcommand: "gratz",
    }).interaction;
    const grouped = createFakeChatInteraction({
      subcommand: "list",
      subcommandGroup: "gratzmessage",
    }).interaction;

    expect(isPublicBirthdaySubcommand(del)).toBe(false);
    expect(isPublicBirthdaySubcommand(gratz)).toBe(false);
    expect(isPublicBirthdaySubcommand(grouped)).toBe(false);
  });

  it("allows restricted /bd delete in the configured channel for allowed roles", async () => {
    const { interaction, reply, followUp } = createFakeChatInteraction({
      channelId: "channel-1",
      roleIds: ["role-b"],
      subcommand: "delete",
    });

    const allowed = await ensureBirthdayAccess(interaction, accessConfig, {
      requireRole: !isPublicBirthdaySubcommand(interaction),
    });

    expect(allowed).toBe(true);
    expect(reply).not.toHaveBeenCalled();
    expect(followUp).not.toHaveBeenCalled();
  });

  it("denies restricted /bd delete in the configured channel without allowed roles", async () => {
    const { interaction, reply } = createFakeChatInteraction({
      channelId: "channel-1",
      roleIds: ["role-x"],
      subcommand: "delete",
    });

    const allowed = await ensureBirthdayAccess(interaction, accessConfig, {
      requireRole: !isPublicBirthdaySubcommand(interaction),
    });

    expect(allowed).toBe(false);
    expect(reply).toHaveBeenCalledWith({
      content:
        "Команды /bd доступны только в канале <#channel-1> и для ролей: <@&role-a>, <@&role-b>",
      ephemeral: true,
    });
  });

  it("allows interaction when channel and at least one role match", async () => {
    const { interaction, reply, followUp } = createFakeChatInteraction({
      channelId: "channel-1",
      roleIds: ["role-x", "role-b"],
    });

    expect(hasBirthdayAccess(interaction, accessConfig)).toBe(true);

    const allowed = await ensureBirthdayAccess(interaction, accessConfig);
    expect(allowed).toBe(true);
    expect(reply).not.toHaveBeenCalled();
    expect(followUp).not.toHaveBeenCalled();
  });

  it("allows interaction in allowed channel without role when role is not required", async () => {
    const { interaction, reply, followUp } = createFakeChatInteraction({
      channelId: "channel-1",
      roleIds: [],
    });

    expect(
      hasBirthdayAccess(interaction, accessConfig, { requireRole: false }),
    ).toBe(true);

    const allowed = await ensureBirthdayAccess(interaction, accessConfig, {
      requireRole: false,
    });
    expect(allowed).toBe(true);
    expect(reply).not.toHaveBeenCalled();
    expect(followUp).not.toHaveBeenCalled();
  });

  it("denies interaction in wrong channel with ephemeral reply", async () => {
    const { interaction, reply } = createFakeChatInteraction({
      channelId: "channel-2",
      roleIds: ["role-a"],
    });

    const allowed = await ensureBirthdayAccess(interaction, accessConfig);

    expect(allowed).toBe(false);
    expect(reply).toHaveBeenCalledWith({
      content:
        "Команды /bd доступны только в канале <#channel-1> и для ролей: <@&role-a>, <@&role-b>",
      ephemeral: true,
    });
  });

  it("denies interaction in DM", async () => {
    const { interaction, reply } = createFakeChatInteraction({
      inGuild: false,
      roleIds: ["role-a"],
    });

    const allowed = await ensureBirthdayAccess(interaction, accessConfig);

    expect(allowed).toBe(false);
    expect(reply).toHaveBeenCalledTimes(1);
  });

  it("denies public subcommand outside allowed channel with channel-only message", async () => {
    const { interaction, reply } = createFakeChatInteraction({
      channelId: "channel-2",
      roleIds: [],
      subcommand: "me",
    });

    const allowed = await ensureBirthdayAccess(interaction, accessConfig, {
      requireRole: false,
    });

    expect(allowed).toBe(false);
    expect(reply).toHaveBeenCalledWith({
      content: "Команды /bd доступны только в канале <#channel-1>",
      ephemeral: true,
    });
  });

  it("uses followUp if interaction already replied", async () => {
    const { interaction, reply, followUp } = createFakeChatInteraction({
      channelId: "channel-2",
      roleIds: ["role-a"],
      replied: true,
    });

    const allowed = await ensureBirthdayAccess(interaction, accessConfig);

    expect(allowed).toBe(false);
    expect(reply).not.toHaveBeenCalled();
    expect(followUp).toHaveBeenCalledTimes(1);
  });

  it("supports modal interactions with guild-member role cache", () => {
    const modalInteraction = createFakeModalInteractionWithRoleCache([
      "role-z",
      "role-b",
    ]);

    expect(hasBirthdayAccess(modalInteraction, accessConfig)).toBe(true);
  });
});
