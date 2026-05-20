import {
  MessageFlags,
  type ChatInputCommandInteraction,
  type GuildMember,
  type InteractionReplyOptions,
} from "discord.js";
import Database from "../../db";
import MembersProcessor from "../../modules/members/processor";
import MembersResponse from "../../modules/members/response";
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
const membersResponse = new MembersResponse();

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

    await interaction.editReply(
      membersResponse.buildCheckResponse(user.id, outcome),
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

    await interaction.editReply(membersResponse.buildCheckAllResponse(result));
    return;
  }

  if (subcommand === "add") {
    const user = interaction.options.getUser("user", true);
    const wasAdded = await processor.addPendingKickUser(guildId, user.id);

    await respond(
      interaction,
      membersResponse.buildAddResponse(user.id, wasAdded),
      {
        flags: EPHEMERAL_FLAGS,
      },
    );
    return;
  }

  if (subcommand === "remove") {
    const user = interaction.options.getUser("user", true);
    const removed = await processor.removePendingKickUser(guildId, user.id);

    await respond(
      interaction,
      membersResponse.buildRemoveResponse(user.id, removed),
      {
        flags: EPHEMERAL_FLAGS,
      },
    );
    return;
  }

  if (subcommand === "list") {
    const records = await processor.listPendingKickUsers(guildId);
    await respond(interaction, membersResponse.buildListResponse(records), {
      flags: EPHEMERAL_FLAGS,
    });
    return;
  }

  if (subcommand === "kick") {
    await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

    const records = await processor.listPendingKickUsers(guildId);
    if (records.length === 0) {
      await interaction.editReply(membersResponse.buildListResponse(records));
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
    await interaction.editReply(membersResponse.buildKickResponse(result));
    return;
  }

  await respond(interaction, membersResponse.buildUnknownSubcommandResponse(), {
    flags: EPHEMERAL_FLAGS,
  });
}

const kickQueueHandler = {
  handleCommand,
};

export default kickQueueHandler;
