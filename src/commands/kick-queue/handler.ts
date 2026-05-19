import {
  MessageFlags,
  type ChatInputCommandInteraction,
  type GuildMember,
  type InteractionReplyOptions,
} from "discord.js";
import Database from "../../db";
import MembersProcessor from "../../modules/members/processor";
import KickQueueService from "../../modules/members/services/kick-queue-service";
import { KICK_QUEUE_SEND_CHECK_MESSAGE_JOB } from "../../jobs/handlers/kickqueue";
import JMProvider from "../../jobs/JobManagerProvider";
import commandAccess from "../shared/command-access";

type EnqueueCheckMessageJob = (
  guildId: string,
  userId: string,
) => Promise<void>;
interface CheckAllConfig {
  excludedRoleIds: Set<string>;
  excludedUserIds: Set<string>;
}

interface CheckAllResult {
  addedCount: number;
  alreadyPendingCount: number;
  excludedCount: number;
  failedCount: number;
}

const EPHEMERAL_FLAGS = MessageFlags.Ephemeral;
const kickQueueService = new KickQueueService(Database.client);

async function enqueueCheckMessageJob(
  guildId: string,
  userId: string,
): Promise<void> {
  const JobManager = JMProvider.get();
  await JobManager.enqueue(KICK_QUEUE_SEND_CHECK_MESSAGE_JOB, {
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
    .map((userId, index) => `${index + 1}. <@${userId}>`)
    .join(", ");
}

async function fetchGuildMemberByUserId(
  interaction: ChatInputCommandInteraction,
  userId: string,
): Promise<GuildMember | null> {
  if (!interaction.guild) {
    return null;
  }

  try {
    return await interaction.guild.members.fetch(userId);
  } catch {
    return null;
  }
}

function loadCheckAllConfig(
  env: NodeJS.ProcessEnv = process.env,
): CheckAllConfig {
  return {
    excludedRoleIds: new Set(commandAccess.parseIds(env.KICK_ROLE_EXCLUDE_IDS)),
    excludedUserIds: new Set(commandAccess.parseIds(env.KICK_USER_EXCLUDE_IDS)),
  };
}

async function fetchGuildMembers(
  interaction: ChatInputCommandInteraction,
): Promise<GuildMember[]> {
  if (!interaction.guild) {
    return [];
  }

  const members = await interaction.guild.members.fetch();
  return [...members.values()];
}

function isExcludedMember(
  member: GuildMember,
  config: CheckAllConfig,
): boolean {
  if (config.excludedUserIds.has(member.user.id)) {
    return true;
  }

  return [...member.roles.cache.keys()].some((roleId) =>
    config.excludedRoleIds.has(roleId),
  );
}

async function handleCommand(
  interaction: ChatInputCommandInteraction,
  service: KickQueueService = kickQueueService,
  enqueueJob: EnqueueCheckMessageJob = enqueueCheckMessageJob,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guildId) {
    await respond(interaction, "Команда доступна только на сервере", {
      flags: EPHEMERAL_FLAGS,
    });
    return;
  }

  const guildId = interaction.guildId;
  const subcommand = interaction.options.getSubcommand();
  const processor = new MembersProcessor(service);

  if (subcommand === "check") {
    const user = interaction.options.getUser("user", true);
    await interaction.deferReply({ flags: EPHEMERAL_FLAGS });
    const outcome = await processor.addPendingKickUserAndEnqueueJob(
      guildId,
      user.id,
      enqueueJob,
    );

    if (outcome === "already-pending") {
      await interaction.editReply(
        `Пользователь <@${user.id}> уже находится в очереди на кик, сообщение повторно не поставлено в очередь отправки`,
      );
      return;
    }

    if (outcome === "enqueue-failed") {
      await interaction.editReply(
        `Пользователь <@${user.id}> не добавлен в очередь на кик, сообщение не удалось поставить в очередь отправки`,
      );
      return;
    }

    await interaction.editReply(
      `Пользователь <@${user.id}> добавлен в очередь на кик, сообщение поставлено в очередь отправки`,
    );
    return;
  }

  if (subcommand === "checkall") {
    await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

    const config = loadCheckAllConfig(env);
    const members = await fetchGuildMembers(interaction);
    const eligibleMembers = members.filter(
      (member) => !isExcludedMember(member, config),
    );
    const orchestrationResult = await processor.queueEligibleMembers(
      guildId,
      eligibleMembers.map((member) => member.user.id),
      enqueueJob,
    );
    const result: CheckAllResult = {
      ...orchestrationResult,
      excludedCount: members.length - eligibleMembers.length,
    };

    await interaction.editReply(
      `В очередь на кик добавлено ${result.addedCount} пользователей, уже в очереди ${result.alreadyPendingCount} пользователей, исключено ${result.excludedCount} пользователей, не удалось поставить в очередь отправки для ${result.failedCount} пользователей, сообщения поставлены в очередь отправки только для новых пользователей`,
    );
    return;
  }

  if (subcommand === "add") {
    const user = interaction.options.getUser("user", true);
    const wasAdded = await processor.addPendingKickUser(guildId, user.id);
    await respond(
      interaction,
      wasAdded
        ? `Пользователь <@${user.id}> добавлен в очередь на кик`
        : `Пользователь <@${user.id}> уже находится в очереди на кик`,
      { flags: EPHEMERAL_FLAGS },
    );
    return;
  }

  if (subcommand === "remove") {
    const user = interaction.options.getUser("user", true);
    const removed = await processor.removePendingKickUser(guildId, user.id);

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
    const records = await processor.listPendingKickUsers(guildId);
    await respond(
      interaction,
      records.length === 0
        ? "Очередь пользователей на кик пуста"
        : formatPendingKickList(records.map((record) => record.discordUserId)),
      { flags: EPHEMERAL_FLAGS },
    );
    return;
  }

  if (subcommand === "kick") {
    await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

    const records = await processor.listPendingKickUsers(guildId);
    if (records.length === 0) {
      await interaction.editReply("Очередь пользователей на кик пуста");
      return;
    }

    const result = await processor.kickQueuedUsers(
      guildId,
      records,
      async (userId) => {
        const member = await fetchGuildMemberByUserId(interaction, userId);
        if (!member) {
          return "not-found";
        }

        try {
          await member.kick();
          return "kicked";
        } catch {
          return "failed";
        }
      },
    );
    await interaction.editReply(
      `Кикнуто ${result.kickedCount} пользователей, не найдено на сервере ${result.notFoundCount} пользователей, не удалось кикнуть ${result.failedCount} пользователей, в очереди оставлено ${result.notFoundCount + result.failedCount} пользователей`,
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
