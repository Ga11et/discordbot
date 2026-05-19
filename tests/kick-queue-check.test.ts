import { describe, expect, it, vi } from "vitest";
import { MessageFlags, type ButtonInteraction, type User } from "discord.js";
import kickQueueCheck from "../src/commands/kick-queue/check";
import type { KickQueueService } from "../src/modules/members/kick-queue-service";

function createServiceMock(): KickQueueService {
  return {
    listPendingKickUsers: vi.fn().mockResolvedValue([]),
    addPendingKickUser: vi.fn().mockResolvedValue(undefined),
    removePendingKickUser: vi.fn().mockResolvedValue(false),
  } as unknown as KickQueueService;
}

function createButtonInteraction(options: {
  customId: string;
  userId?: string;
}) {
  const update = vi.fn().mockResolvedValue(undefined);
  const reply = vi.fn().mockResolvedValue(undefined);

  const interaction = {
    customId: options.customId,
    user: {
      id: options.userId ?? "user-1",
    },
    update,
    reply,
  } as unknown as ButtonInteraction;

  return { interaction, update, reply };
}

describe("sendKickQueueCheckMessage", () => {
  it("sends a DM with stay and ignore buttons", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const user = {
      id: "user-1",
      send,
    } as unknown as User;

    await kickQueueCheck.sendCheckMessage(user, "guild-1");

    expect(send).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(send).mock.calls[0][0];
    expect(payload.content).toContain("Это важное сообщение!");
    expect(payload.content).toContain(
      "Это плановая очистка неактивных аккаунтов и незаинтересованных пользователей, которая проводится раз в 6–12 месяцев",
    );
    expect(payload.components).toHaveLength(1);

    const row = payload.components?.[0]?.toJSON();
    expect(row?.components).toHaveLength(2);
    expect(row?.components[0]).toMatchObject({
      custom_id: "kickqueue:stay:guild-1:user-1",
      label: "Остаться",
    });
    expect(row?.components[1]).toMatchObject({
      custom_id: "kickqueue:ignore:guild-1:user-1",
      label: "Игнорировать",
    });
  });
});

describe("handleKickQueueButtonInteraction", () => {
  it("returns false for unrelated buttons", async () => {
    const service = createServiceMock();
    const { interaction, update, reply } = createButtonInteraction({
      customId: "birthday:other",
    });

    const handled = await kickQueueCheck.handleButtonInteraction(
      interaction,
      service,
    );

    expect(handled).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(reply).not.toHaveBeenCalled();
  });

  it("removes the user from the kick queue when stay is clicked", async () => {
    const service = createServiceMock();
    vi.mocked(service.removePendingKickUser).mockResolvedValue(true);
    const { interaction, update } = createButtonInteraction({
      customId: "kickqueue:stay:guild-1:user-1",
      userId: "user-1",
    });

    const handled = await kickQueueCheck.handleButtonInteraction(
      interaction,
      service,
    );

    expect(handled).toBe(true);
    expect(service.removePendingKickUser).toHaveBeenCalledWith(
      "guild-1",
      "user-1",
    );
    expect(update).toHaveBeenCalledWith({
      content: expect.stringContaining(
        "Вы выбрали остаться на сервере и были удалены из очереди на кик.",
      ),
      components: [],
    });
  });

  it("updates the DM and removes the ignore button when ignore is clicked", async () => {
    const service = createServiceMock();
    const { interaction, update } = createButtonInteraction({
      customId: "kickqueue:ignore:guild-1:user-1",
      userId: "user-1",
    });

    const handled = await kickQueueCheck.handleButtonInteraction(
      interaction,
      service,
    );

    expect(handled).toBe(true);
    expect(service.removePendingKickUser).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);

    const payload = vi.mocked(update).mock.calls[0][0];
    expect(payload.content).toContain(
      "Предложение остаться было проигнорировано.",
    );
    expect(payload.components).toHaveLength(1);

    const row = payload.components?.[0]?.toJSON();
    expect(row?.components).toHaveLength(1);
    expect(row?.components[0]).toMatchObject({
      custom_id: "kickqueue:stay:guild-1:user-1",
      label: "Остаться",
    });
  });

  it("rejects clicks from a different user", async () => {
    const service = createServiceMock();
    const { interaction, reply, update } = createButtonInteraction({
      customId: "kickqueue:stay:guild-1:user-1",
      userId: "user-2",
    });

    const handled = await kickQueueCheck.handleButtonInteraction(
      interaction,
      service,
    );

    expect(handled).toBe(true);
    expect(update).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith({
      content: "Эта кнопка предназначена для другого пользователя.",
      flags: MessageFlags.Ephemeral,
    });
  });

  it("marks the offer unavailable if the user is no longer in the queue", async () => {
    const service = createServiceMock();
    vi.mocked(service.removePendingKickUser).mockResolvedValue(false);
    const { interaction, update } = createButtonInteraction({
      customId: "kickqueue:stay:guild-1:user-1",
      userId: "user-1",
    });

    const handled = await kickQueueCheck.handleButtonInteraction(
      interaction,
      service,
    );

    expect(handled).toBe(true);
    expect(update).toHaveBeenCalledWith({
      content: expect.stringContaining("Это предложение уже неактуально."),
      components: [],
    });
  });
});
