import {
  MessageFlags,
  type ChatInputCommandInteraction,
  type GuildMember,
  type InteractionReplyOptions,
} from "discord.js";
import Database from "../../db";
import { AppError } from "../../utils/errors";
import { BirthController } from "../../modules/birth/controller";
import { BIRTH_SEND_CHECK_MESSAGE_JOB } from "../../jobs/handlers/birth";
import JMProvider from "../../jobs/JobManagerProvider";
import { birthResponse, type CheckAllResult } from "./response";

const EPHEMERAL_FLAGS = MessageFlags.Ephemeral;
const controller = new BirthController(Database.client);

async function enqueueCheckMessageJob(
  guildId: string,
  userId: string,
): Promise<void> {
  const jobManager = JMProvider.get();
  await jobManager.enqueue(BIRTH_SEND_CHECK_MESSAGE_JOB, { guildId, userId });
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

function resolveErrorMessage(error: AppError, context: string): string {
  if (error.code === "NOT_FOUND") {
    return context === "birthday-self"
      ? birthResponse.notFound()
      : birthResponse.userNotFound(context.slice("birthday-other:".length));
  }
  if (error.code === "INVALID_FORMAT") return birthResponse.dateFormatError();
  if (error.code === "INVALID_DATE") return birthResponse.dateInvalidError();
  return birthResponse.unexpectedError();
}

async function handleBirthdaySubcommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "me") {
    try {
      const record = await controller.getOwnBirthday(interaction.user.id);
      await respond(
        interaction,
        birthResponse.ownBirthday(record.birthdayDate),
        { ephemeral: true },
      );
    } catch (error) {
      if (error instanceof AppError) {
        await respond(interaction, resolveErrorMessage(error, "birthday-self"), {
          ephemeral: true,
        });
        return;
      }
      console.error("Ошибка при обработке /birth me", error);
      await respond(interaction, birthResponse.unexpectedError(), { ephemeral: true });
    }
    return;
  }

  if (subcommand === "get") {
    const targetUser = interaction.options.getUser("user", true);
    try {
      const record = await controller.getBirthday(targetUser.id);
      const message = record
        ? birthResponse.userBirthday(targetUser.id, record.birthdayDate)
        : birthResponse.userBirthdayNotFound(targetUser.id);
      await respond(interaction, message, { ephemeral: true });
    } catch (error) {
      console.error("Ошибка при обработке /birth get", error);
      await respond(interaction, birthResponse.unexpectedError(), { ephemeral: true });
    }
    return;
  }

  if (subcommand === "set") {
    const dateInput = interaction.options.getString("date", true);
    const targetUser = interaction.options.getUser("user");
    try {
      const result = await controller.setBirthday(
        interaction.user.id,
        dateInput,
        targetUser?.id,
      );
      await respond(interaction, birthResponse.setBirthday(result), {
        ephemeral: targetUser?.id === interaction.user.id || !targetUser,
      });
    } catch (error) {
      if (error instanceof AppError) {
        await respond(interaction, resolveErrorMessage(error, "set"), {
          ephemeral: true,
        });
        return;
      }
      console.error("Ошибка при обработке /birth set", error);
      await respond(interaction, birthResponse.unexpectedError(), { ephemeral: true });
    }
    return;
  }

  if (subcommand === "delete") {
    const targetUser = interaction.options.getUser("user", true);
    try {
      const result = await controller.deleteBirthday(targetUser.id);
      await respond(
        interaction,
        birthResponse.deleteBirthday(result.targetUserId),
        { ephemeral: true },
      );
    } catch (error) {
      if (error instanceof AppError) {
        await respond(
          interaction,
          resolveErrorMessage(error, `birthday-other:${targetUser.id}`),
          { ephemeral: true },
        );
        return;
      }
      console.error("Ошибка при обработке /birth delete", error);
      await respond(interaction, birthResponse.unexpectedError(), { ephemeral: true });
    }
    return;
  }

  if (subcommand === "list") {
    try {
      const entries = await controller.listBirthdays();
      await respond(interaction, birthResponse.listBirthdays(entries));
    } catch (error) {
      console.error("Ошибка при обработке /birth list", error);
      await respond(interaction, birthResponse.unexpectedError(), { ephemeral: true });
    }
    return;
  }

  await respond(interaction, birthResponse.unexpectedError(), { ephemeral: true });
}

async function handleCheckSubcommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guildId) {
    await respond(interaction, "Команда доступна только на сервере", { flags: EPHEMERAL_FLAGS });
    return;
  }

  const guildId = interaction.guildId;
  const targetUser = interaction.options.getUser("user", true);
  const userId = targetUser.id;

  await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

  const existing = await controller.getBirthday(userId);
  if (existing) {
    await interaction.editReply(birthResponse.checkAlreadySet(userId));
    return;
  }

  const added = await controller.addToCheckQueue(guildId, userId);
  if (!added) {
    await interaction.editReply(birthResponse.checkAlreadyPending(userId));
    return;
  }

  try {
    await enqueueCheckMessageJob(guildId, userId);
    await interaction.editReply(birthResponse.checkEnqueued(userId));
  } catch {
    await controller.removeFromCheckQueue(guildId, userId);
    await interaction.editReply(birthResponse.checkEnqueueFailed(userId));
  }
}

async function handleCheckAllSubcommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guildId) {
    await respond(interaction, "Команда доступна только на сервере", { flags: EPHEMERAL_FLAGS });
    return;
  }

  const guildId = interaction.guildId;
  await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

  const members = await fetchGuildMembers(interaction);
  const eligibleMembers = members.filter((m) => !m.user.bot);

  const result: CheckAllResult = { added: 0, alreadyPending: 0, alreadySet: 0, failed: 0 };

  for (const member of eligibleMembers) {
    const userId = member.user.id;

    const existing = await controller.getBirthday(userId);
    if (existing) {
      result.alreadySet += 1;
      continue;
    }

    const added = await controller.addToCheckQueue(guildId, userId);
    if (!added) {
      result.alreadyPending += 1;
      continue;
    }

    try {
      await enqueueCheckMessageJob(guildId, userId);
      result.added += 1;
    } catch {
      await controller.removeFromCheckQueue(guildId, userId);
      result.failed += 1;
    }
  }

  await interaction.editReply(birthResponse.checkAllResult(result));
}

async function handleQueueSubcommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guildId) {
    await respond(interaction, "Команда доступна только на сервере", { flags: EPHEMERAL_FLAGS });
    return;
  }

  const records = await controller.listCheckQueue(interaction.guildId);
  await respond(interaction, birthResponse.checkQueue(records), { flags: EPHEMERAL_FLAGS });
}

async function handleCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "check") {
    await handleCheckSubcommand(interaction);
    return;
  }

  if (subcommand === "checkall") {
    await handleCheckAllSubcommand(interaction);
    return;
  }

  if (subcommand === "queue") {
    await handleQueueSubcommand(interaction);
    return;
  }

  await handleBirthdaySubcommand(interaction);
}

const birthHandler = { handleCommand };

export default birthHandler;
