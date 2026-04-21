import { describe, expect, it, vi } from "vitest";
import type { ChatInputCommandInteraction } from "discord.js";
import {
  ensureKickQueueAccess,
  hasKickQueueAccess,
  loadKickQueueAccessConfig,
  type KickQueueAccessConfig,
} from "../src/commands/kick-queue-access";

interface FakeInteractionOptions {
  inGuild?: boolean;
  channelId?: string;
  roleIds?: string[];
  deferred?: boolean;
  replied?: boolean;
}

function createFakeInteraction(options: FakeInteractionOptions = {}) {
  const reply = vi.fn().mockResolvedValue(undefined);
  const followUp = vi.fn().mockResolvedValue(undefined);

  const interaction = {
    inGuild: () => options.inGuild ?? true,
    channelId: options.channelId ?? "channel-1",
    member: options.roleIds ? { roles: options.roleIds } : null,
    deferred: options.deferred ?? false,
    replied: options.replied ?? false,
    reply,
    followUp,
  } as unknown as ChatInputCommandInteraction;

  return { interaction, reply, followUp };
}

const accessConfig: KickQueueAccessConfig = {
  allowedChannelId: "channel-1",
  allowedRoleIds: ["role-a", "role-b"],
};

describe("loadKickQueueAccessConfig", () => {
  it("parses channel id and list of role ids", () => {
    const config = loadKickQueueAccessConfig({
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
      loadKickQueueAccessConfig({ BD_ALLOWED_ROLE_IDS: "role-a" }),
    ).toThrow("BD_ALLOWED_CHANNEL_ID is not set");
  });

  it("throws when role ids are missing or empty", () => {
    expect(() =>
      loadKickQueueAccessConfig({ BD_ALLOWED_CHANNEL_ID: "channel-1" }),
    ).toThrow("BD_ALLOWED_ROLE_IDS is not set");

    expect(() =>
      loadKickQueueAccessConfig({
        BD_ALLOWED_CHANNEL_ID: "channel-1",
        BD_ALLOWED_ROLE_IDS: " , , ",
      }),
    ).toThrow("BD_ALLOWED_ROLE_IDS must contain at least one role id");
  });
});

describe("kickqueue access checks", () => {
  it("allows interaction when channel and at least one role match", async () => {
    const { interaction, reply, followUp } = createFakeInteraction({
      channelId: "channel-1",
      roleIds: ["role-x", "role-b"],
    });

    expect(hasKickQueueAccess(interaction, accessConfig)).toBe(true);

    const allowed = await ensureKickQueueAccess(interaction, accessConfig);
    expect(allowed).toBe(true);
    expect(reply).not.toHaveBeenCalled();
    expect(followUp).not.toHaveBeenCalled();
  });

  it("denies interaction in wrong channel with ephemeral reply", async () => {
    const { interaction, reply } = createFakeInteraction({
      channelId: "channel-2",
      roleIds: ["role-a"],
    });

    const allowed = await ensureKickQueueAccess(interaction, accessConfig);

    expect(allowed).toBe(false);
    expect(reply).toHaveBeenCalledWith({
      content:
        "Команды /kickqueue доступны только в канале <#channel-1> и для ролей: <@&role-a>, <@&role-b>",
      ephemeral: true,
    });
  });

  it("denies interaction without allowed role", async () => {
    const { interaction, reply } = createFakeInteraction({
      channelId: "channel-1",
      roleIds: ["role-x"],
    });

    const allowed = await ensureKickQueueAccess(interaction, accessConfig);

    expect(allowed).toBe(false);
    expect(reply).toHaveBeenCalledTimes(1);
  });

  it("uses followUp if interaction already replied", async () => {
    const { interaction, reply, followUp } = createFakeInteraction({
      channelId: "channel-2",
      roleIds: ["role-a"],
      replied: true,
    });

    const allowed = await ensureKickQueueAccess(interaction, accessConfig);

    expect(allowed).toBe(false);
    expect(reply).not.toHaveBeenCalled();
    expect(followUp).toHaveBeenCalledTimes(1);
  });
});
