import {
  MessageFlags,
  type ChatInputCommandInteraction,
  type InteractionReplyOptions,
} from "discord.js";
import {
  KickQueueService,
  kickQueueService,
} from "../members/kick-queue-service";
import { KICK_QUEUE_SEND_CHECK_MESSAGE_JOB } from "../jobs/kick-queue-job-executor";
import { minuteJobQueue } from "../jobs/minute-job-queue";

type EnqueueCheckMessageJob = (
  guildId: string,
  userId: string,
) => Promise<void>;
const EPHEMERAL_FLAGS = MessageFlags.Ephemeral;

async function enqueueCheckMessageJob(
  guildId: string,
  userId: string,
): Promise<void> {
  await minuteJobQueue.enqueue(KICK_QUEUE_SEND_CHECK_MESSAGE_JOB, {
    guildId,
    userId,
  });
}

async function respond(
  interaction: ChatInputCommandInteraction,
  content: string,
  options?: Omit<InteractionReplyOptions, "content">,
): Promise<void> {
  const payload: InteractionReplyOptions = { content, ...options };

  if (interaction.deferred) {
    await interaction.editReply({ content });
  } else if (interaction.replied) {
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

async function handleCommand(
  interaction: ChatInputCommandInteraction,
  service: KickQueueService = kickQueueService,
  enqueueJob: EnqueueCheckMessageJob = enqueueCheckMessageJob,
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guildId) {
    await respond(interaction, "Команда доступна только на сервере", {
      flags: EPHEMERAL_FLAGS,
    });
    return;
  }

  const guildId = interaction.guildId;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "check") {
    const user = interaction.options.getUser("user", true);
    await interaction.deferReply({ flags: EPHEMERAL_FLAGS });
    await service.addPendingKickUser(guildId, user.id);
    await enqueueJob(guildId, user.id);
    await interaction.editReply(
      `Пользователь <@${user.id}> добавлен в очередь на кик, сообщение поставлено в очередь отправки`,
    );
    return;
  }

  if (subcommand === "add") {
    const user = interaction.options.getUser("user", true);
    await service.addPendingKickUser(guildId, user.id);
    await respond(
      interaction,
      `Пользователь <@${user.id}> добавлен в очередь на кик`,
      { flags: EPHEMERAL_FLAGS },
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
      { flags: EPHEMERAL_FLAGS },
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
      { flags: EPHEMERAL_FLAGS },
    );
    return;
  }

  await respond(interaction, "Неизвестная подкоманда kickqueue", {
    flags: EPHEMERAL_FLAGS,
  });
}

const kickQueueHandler = {
  handleCommand,
};

export default kickQueueHandler;
