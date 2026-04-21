import type {
  ChatInputCommandInteraction,
  InteractionReplyOptions,
} from "discord.js";
import {
  KickQueueService,
  kickQueueService,
} from "../members/kick-queue-service";

async function respond(
  interaction: ChatInputCommandInteraction,
  content: string,
  options?: Omit<InteractionReplyOptions, "content">,
): Promise<void> {
  const payload: InteractionReplyOptions = { content, ...options };

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload);
  } else {
    await interaction.reply(payload);
  }
}

function formatPendingKickList(userIds: string[]): string {
  return userIds
    .map((userId, index) => `${index + 1}. <@${userId}> (\`${userId}\`)`)
    .join("\n");
}

export async function handleKickQueueCommand(
  interaction: ChatInputCommandInteraction,
  service: KickQueueService = kickQueueService,
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guildId) {
    await respond(interaction, "Команда доступна только на сервере", {
      ephemeral: true,
    });
    return;
  }

  const guildId = interaction.guildId;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "add") {
    const user = interaction.options.getUser("user", true);
    await service.addPendingKickUser(guildId, user.id);
    await respond(
      interaction,
      `Пользователь <@${user.id}> добавлен в очередь на кик`,
      { ephemeral: true },
    );
    return;
  }

  if (subcommand === "remove") {
    const user = interaction.options.getUser("user", true);
    const removed = await service.removePendingKickUser(guildId, user.id);

    await respond(
      interaction,
      removed
        ? `Пользователь <@${user.id}> удалён из очереди на кик`
        : `Пользователь <@${user.id}> не найден в очереди на кик`,
      { ephemeral: true },
    );
    return;
  }

  if (subcommand === "list") {
    const records = await service.listPendingKickUsers(guildId);
    await respond(
      interaction,
      records.length === 0
        ? "Очередь пользователей на кик пуста"
        : formatPendingKickList(records.map((record) => record.discordUserId)),
      { ephemeral: true },
    );
    return;
  }

  await respond(interaction, "Неизвестная подкоманда kickqueue", {
    ephemeral: true,
  });
}
