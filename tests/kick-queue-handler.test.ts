import { describe, expect, it, vi } from "vitest";
import { MessageFlags, type ChatInputCommandInteraction } from "discord.js";
import kickQueueHandler from "../src/commands/kick-queue-handler";
import type { KickQueueService } from "../src/members/kick-queue-service";

interface FakeGuildMemberOptions {
  roleIds?: string[];
  userId: string;
}

interface FakeKickQueueInteractionOptions {
  guildId?: string | null;
  guildMembers?: FakeGuildMemberOptions[];
  inGuild?: boolean;
  subcommand?: "check" | "checkall" | "add" | "remove" | "list";
  userId?: string;
  deferred?: boolean;
  replied?: boolean;
}

function createServiceMock(): KickQueueService {
  return {
    listPendingKickUsers: vi.fn().mockResolvedValue([]),
    addPendingKickUser: vi.fn().mockResolvedValue(true),
    removePendingKickUser: vi.fn().mockResolvedValue(false),
  } as unknown as KickQueueService;
}

function createGuildMember(options: FakeGuildMemberOptions) {
  return {
    roles: {
      cache: new Map(
        options.roleIds?.map((roleId) => [roleId, { id: roleId }]) ?? [],
      ),
    },
    user: {
      id: options.userId,
    },
  };
}

function createFakeInteraction(options: FakeKickQueueInteractionOptions = {}) {
  const reply = vi.fn().mockResolvedValue(undefined);
  const followUp = vi.fn().mockResolvedValue(undefined);
  const deferReply = vi.fn().mockResolvedValue(undefined);
  const editReply = vi.fn().mockResolvedValue(undefined);
  const guildMembers = options.guildMembers ?? [];

  const interaction = {
    guild: {
      members: {
        fetch: vi
          .fn()
          .mockResolvedValue(
            new Map(
              guildMembers.map((member) => [
                member.userId,
                createGuildMember(member),
              ]),
            ),
          ),
      },
    },
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
    deferReply,
    editReply,
  } as unknown as ChatInputCommandInteraction;

  return { interaction, reply, followUp, deferReply, editReply };
}

describe("handleKickQueueCommand", () => {
  it("rejects non-guild invocation", async () => {
    const service = createServiceMock();
    const { interaction, reply } = createFakeInteraction({
      inGuild: false,
      guildId: null,
    });

    await kickQueueHandler.handleCommand(interaction, service);

    expect(reply).toHaveBeenCalledWith({
      content: "Команда доступна только на сервере",
      flags: MessageFlags.Ephemeral,
    });
    expect(service.listPendingKickUsers).not.toHaveBeenCalled();
  });

  it("queues a user and enqueues the DM send job", async () => {
    const service = createServiceMock();
    const enqueueJob = vi.fn().mockResolvedValue(undefined);
    const { interaction, deferReply, editReply, reply } = createFakeInteraction(
      {
        subcommand: "check",
        userId: "user-55",
      },
    );

    await kickQueueHandler.handleCommand(interaction, service, enqueueJob);

    expect(deferReply).toHaveBeenCalledWith({
      flags: MessageFlags.Ephemeral,
    });
    expect(service.addPendingKickUser).toHaveBeenCalledWith(
      "guild-1",
      "user-55",
    );
    expect(enqueueJob).toHaveBeenCalledWith("guild-1", "user-55");
    expect(editReply).toHaveBeenCalledWith(
      "Пользователь <@user-55> добавлен в очередь на кик, сообщение поставлено в очередь отправки",
    );
    expect(reply).not.toHaveBeenCalled();
  });

  it("keeps the pending kick entry after enqueueing a DM send job", async () => {
    const service = createServiceMock();
    const enqueueJob = vi.fn().mockResolvedValue(undefined);
    const { interaction, deferReply, editReply, reply } = createFakeInteraction(
      {
        subcommand: "check",
        userId: "user-56",
      },
    );

    await kickQueueHandler.handleCommand(interaction, service, enqueueJob);

    expect(deferReply).toHaveBeenCalledWith({
      flags: MessageFlags.Ephemeral,
    });
    expect(service.addPendingKickUser).toHaveBeenCalledWith(
      "guild-1",
      "user-56",
    );
    expect(enqueueJob).toHaveBeenCalledWith("guild-1", "user-56");
    expect(service.removePendingKickUser).not.toHaveBeenCalled();
    expect(editReply).toHaveBeenCalledWith(
      "Пользователь <@user-56> добавлен в очередь на кик, сообщение поставлено в очередь отправки",
    );
    expect(reply).not.toHaveBeenCalled();
  });

  it("does not enqueue a duplicate DM send job for a user already pending", async () => {
    const service = createServiceMock();
    vi.mocked(service.addPendingKickUser).mockResolvedValue(false);
    const enqueueJob = vi.fn().mockResolvedValue(undefined);
    const { interaction, deferReply, editReply } = createFakeInteraction({
      subcommand: "check",
      userId: "user-57",
    });

    await kickQueueHandler.handleCommand(interaction, service, enqueueJob);

    expect(deferReply).toHaveBeenCalledWith({
      flags: MessageFlags.Ephemeral,
    });
    expect(service.addPendingKickUser).toHaveBeenCalledWith(
      "guild-1",
      "user-57",
    );
    expect(enqueueJob).not.toHaveBeenCalled();
    expect(editReply).toHaveBeenCalledWith(
      "Пользователь <@user-57> уже находится в очереди на кик, сообщение повторно не поставлено в очередь отправки",
    );
  });

  it("removes the pending kick entry when enqueueing the DM send job fails", async () => {
    const service = createServiceMock();
    const enqueueJob = vi.fn().mockRejectedValue(new Error("boom"));
    const { interaction, editReply } = createFakeInteraction({
      subcommand: "check",
      userId: "user-58",
    });

    await kickQueueHandler.handleCommand(interaction, service, enqueueJob);

    expect(service.addPendingKickUser).toHaveBeenCalledWith(
      "guild-1",
      "user-58",
    );
    expect(enqueueJob).toHaveBeenCalledWith("guild-1", "user-58");
    expect(service.removePendingKickUser).toHaveBeenCalledWith(
      "guild-1",
      "user-58",
    );
    expect(editReply).toHaveBeenCalledWith(
      "Пользователь <@user-58> не добавлен в очередь на кик, сообщение не удалось поставить в очередь отправки",
    );
  });

  it("queues all guild members except excluded users and roles", async () => {
    const service = createServiceMock();
    const enqueueJob = vi.fn().mockResolvedValue(undefined);
    const { interaction, deferReply, editReply, reply } = createFakeInteraction(
      {
        subcommand: "checkall",
        guildMembers: [
          { userId: "user-1" },
          { userId: "user-2", roleIds: ["role-excluded"] },
          { userId: "user-3" },
        ],
      },
    );

    await kickQueueHandler.handleCommand(interaction, service, enqueueJob, {
      KICK_ROLE_EXCLUDE_IDS: "role-excluded",
      KICK_USER_EXCLUDE_IDS: "user-3",
    });

    expect(deferReply).toHaveBeenCalledWith({
      flags: MessageFlags.Ephemeral,
    });
    expect(service.addPendingKickUser).toHaveBeenCalledTimes(1);
    expect(service.addPendingKickUser).toHaveBeenCalledWith(
      "guild-1",
      "user-1",
    );
    expect(enqueueJob).toHaveBeenCalledTimes(1);
    expect(enqueueJob).toHaveBeenCalledWith("guild-1", "user-1");
    expect(editReply).toHaveBeenCalledWith(
      "В очередь на кик добавлено 1 пользователей, уже в очереди 0 пользователей, исключено 2 пользователей, не удалось поставить в очередь отправки для 0 пользователей, сообщения поставлены в очередь отправки только для новых пользователей",
    );
    expect(reply).not.toHaveBeenCalled();
  });

  it("does not enqueue duplicate DM jobs for members already pending in checkall", async () => {
    const service = createServiceMock();
    vi.mocked(service.addPendingKickUser)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const enqueueJob = vi.fn().mockResolvedValue(undefined);
    const { interaction, editReply } = createFakeInteraction({
      subcommand: "checkall",
      guildMembers: [
        { userId: "user-1" },
        { userId: "user-2" },
        { userId: "user-3" },
      ],
    });

    await kickQueueHandler.handleCommand(interaction, service, enqueueJob, {});

    expect(service.addPendingKickUser).toHaveBeenCalledTimes(3);
    expect(enqueueJob).toHaveBeenCalledTimes(2);
    expect(enqueueJob).toHaveBeenNthCalledWith(1, "guild-1", "user-1");
    expect(enqueueJob).toHaveBeenNthCalledWith(2, "guild-1", "user-3");
    expect(editReply).toHaveBeenCalledWith(
      "В очередь на кик добавлено 2 пользователей, уже в очереди 1 пользователей, исключено 0 пользователей, не удалось поставить в очередь отправки для 0 пользователей, сообщения поставлены в очередь отправки только для новых пользователей",
    );
  });

  it("queues all guild members when exclude lists are empty", async () => {
    const service = createServiceMock();
    const enqueueJob = vi.fn().mockResolvedValue(undefined);
    const { interaction, editReply } = createFakeInteraction({
      subcommand: "checkall",
      guildMembers: [{ userId: "user-1" }, { userId: "user-2" }],
    });

    await kickQueueHandler.handleCommand(interaction, service, enqueueJob, {});

    expect(service.addPendingKickUser).toHaveBeenNthCalledWith(
      1,
      "guild-1",
      "user-1",
    );
    expect(service.addPendingKickUser).toHaveBeenNthCalledWith(
      2,
      "guild-1",
      "user-2",
    );
    expect(enqueueJob).toHaveBeenNthCalledWith(1, "guild-1", "user-1");
    expect(enqueueJob).toHaveBeenNthCalledWith(2, "guild-1", "user-2");
    expect(editReply).toHaveBeenCalledWith(
      "В очередь на кик добавлено 2 пользователей, уже в очереди 0 пользователей, исключено 0 пользователей, не удалось поставить в очередь отправки для 0 пользователей, сообщения поставлены в очередь отправки только для новых пользователей",
    );
  });

  it("removes only failed enqueue users from checkall and reports their count", async () => {
    const service = createServiceMock();
    const enqueueJob = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);
    const { interaction, editReply } = createFakeInteraction({
      subcommand: "checkall",
      guildMembers: [
        { userId: "user-1" },
        { userId: "user-2" },
        { userId: "user-3" },
      ],
    });

    await kickQueueHandler.handleCommand(interaction, service, enqueueJob, {});

    expect(service.addPendingKickUser).toHaveBeenCalledTimes(3);
    expect(enqueueJob).toHaveBeenCalledTimes(3);
    expect(service.removePendingKickUser).toHaveBeenCalledTimes(1);
    expect(service.removePendingKickUser).toHaveBeenCalledWith(
      "guild-1",
      "user-2",
    );
    expect(editReply).toHaveBeenCalledWith(
      "В очередь на кик добавлено 2 пользователей, уже в очереди 0 пользователей, исключено 0 пользователей, не удалось поставить в очередь отправки для 1 пользователей, сообщения поставлены в очередь отправки только для новых пользователей",
    );
  });

  it("adds a user to the current guild queue", async () => {
    const service = createServiceMock();
    const { interaction, reply } = createFakeInteraction({
      subcommand: "add",
      userId: "user-77",
    });

    await kickQueueHandler.handleCommand(interaction, service);

    expect(service.addPendingKickUser).toHaveBeenCalledWith(
      "guild-1",
      "user-77",
    );
    expect(reply).toHaveBeenCalledWith({
      content: "Пользователь <@user-77> добавлен в очередь на кик",
      flags: MessageFlags.Ephemeral,
    });
  });

  it("reports when adding a user already present in the current guild queue", async () => {
    const service = createServiceMock();
    vi.mocked(service.addPendingKickUser).mockResolvedValue(false);
    const { interaction, reply } = createFakeInteraction({
      subcommand: "add",
      userId: "user-78",
    });

    await kickQueueHandler.handleCommand(interaction, service);

    expect(service.addPendingKickUser).toHaveBeenCalledWith(
      "guild-1",
      "user-78",
    );
    expect(reply).toHaveBeenCalledWith({
      content: "Пользователь <@user-78> уже находится в очереди на кик",
      flags: MessageFlags.Ephemeral,
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

    await kickQueueHandler.handleCommand(interaction, service);

    expect(service.listPendingKickUsers).toHaveBeenCalledWith("guild-1");
    expect(reply).toHaveBeenCalledWith({
      content: "1. <@user-1> (`user-1`)\n2. <@user-2> (`user-2`)",
      flags: MessageFlags.Ephemeral,
    });
  });

  it("reports when a user is absent from the queue", async () => {
    const service = createServiceMock();
    vi.mocked(service.removePendingKickUser).mockResolvedValue(false);
    const { interaction, reply } = createFakeInteraction({
      subcommand: "remove",
      userId: "user-11",
    });

    await kickQueueHandler.handleCommand(interaction, service);

    expect(service.removePendingKickUser).toHaveBeenCalledWith(
      "guild-1",
      "user-11",
    );
    expect(reply).toHaveBeenCalledWith({
      content: "Пользователь <@user-11> не найден в очереди на кик",
      flags: MessageFlags.Ephemeral,
    });
  });
});
