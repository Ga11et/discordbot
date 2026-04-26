import {
  MessageFlags,
  type ChatInputCommandInteraction,
  type GuildMember,
  type InteractionReplyOptions,
} from "discord.js";
import {
  KickQueueService,
  type PendingKickRecord,
  kickQueueService,
} from "../members/kick-queue-service";
import { KICK_QUEUE_SEND_CHECK_MESSAGE_JOB } from "../jobs/kick-queue-job-executor";
import { minuteJobQueue } from "../jobs/minute-job-queue";
import commandAccess from "./command-access";

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

interface KickQueuedUsersResult {
  kickedCount: number;
  notFoundCount: number;
  failedCount: number;
}

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

async function addPendingKickUserAndEnqueueJob(
  guildId: string,
  userId: string,
  service: KickQueueService,
  enqueueJob: EnqueueCheckMessageJob,
): Promise<"added" | "already-pending" | "enqueue-failed"> {
  const wasAdded = await service.addPendingKickUser(guildId, userId);
  if (!wasAdded) {
    return "already-pending";
  }

  try {
    await enqueueJob(guildId, userId);
    return "added";
  } catch {
    await service.removePendingKickUser(guildId, userId);
    return "enqueue-failed";
  }
}

async function queueEligibleMembers(
  guildId: string,
  members: GuildMember[],
  service: KickQueueService,
  enqueueJob: EnqueueCheckMessageJob,
): Promise<CheckAllResult> {
  let addedCount = 0;
  let alreadyPendingCount = 0;
  let failedCount = 0;

  for (const member of members) {
    const outcome = await addPendingKickUserAndEnqueueJob(
      guildId,
      member.user.id,
      service,
      enqueueJob,
    );
    if (outcome === "already-pending") {
      alreadyPendingCount += 1;
      continue;
    }

    if (outcome === "enqueue-failed") {
      failedCount += 1;
      continue;
    }

    addedCount += 1;
  }

  return {
    addedCount,
    alreadyPendingCount,
    excludedCount: 0,
    failedCount,
  };
}

async function kickQueuedUsers(
  interaction: ChatInputCommandInteraction,
  guildId: string,
  records: PendingKickRecord[],
  service: KickQueueService,
): Promise<KickQueuedUsersResult> {
  let kickedCount = 0;
  let notFoundCount = 0;
  let failedCount = 0;

  for (const record of records) {
    const member = await fetchGuildMemberByUserId(
      interaction,
      record.discordUserId,
    );
    if (!member) {
      notFoundCount += 1;
      continue;
    }

    try {
      await member.kick();
      await service.removePendingKickUser(guildId, record.discordUserId);
      kickedCount += 1;
    } catch {
      failedCount += 1;
    }
  }

  return {
    kickedCount,
    notFoundCount,
    failedCount,
  };
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

  if (subcommand === "check") {
    const user = interaction.options.getUser("user", true);
    await interaction.deferReply({ flags: EPHEMERAL_FLAGS });
    const outcome = await addPendingKickUserAndEnqueueJob(
      guildId,
      user.id,
      service,
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
    const result = await queueEligibleMembers(
      guildId,
      eligibleMembers,
      service,
      enqueueJob,
    );
    result.excludedCount = members.length - eligibleMembers.length;

    await interaction.editReply(
      `В очередь на кик добавлено ${result.addedCount} пользователей, уже в очереди ${result.alreadyPendingCount} пользователей, исключено ${result.excludedCount} пользователей, не удалось поставить в очередь отправки для ${result.failedCount} пользователей, сообщения поставлены в очередь отправки только для новых пользователей`,
    );
    return;
  }

  if (subcommand === "add") {
    const user = interaction.options.getUser("user", true);
    const wasAdded = await service.addPendingKickUser(guildId, user.id);
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

  if (subcommand === "kick") {
    await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

    const records = await service.listPendingKickUsers(guildId);
    if (records.length === 0) {
      await interaction.editReply("Очередь пользователей на кик пуста");
      return;
    }

    const result = await kickQueuedUsers(
      interaction,
      guildId,
      records,
      service,
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
