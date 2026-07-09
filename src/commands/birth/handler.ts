import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildMember,
  type InteractionReplyOptions,
  type ModalActionRowComponentBuilder,
  type ModalSubmitInteraction,
} from "discord.js";
import Database from "../../db";
import { AppError } from "../../utils/errors";
import { BirthController } from "../../modules/birth/base/controller";
import { BirthCheckQueueController } from "../../modules/birth/check-queue/controller";
import { BirthdayGratzLogController } from "../../modules/birth/gratz-log/controller";
import { GratzMessageController } from "../../modules/birth/gratz-message/controller";
import { BIRTH_SEND_CHECK_MESSAGE_JOB } from "../../jobs/handlers/birth";
import JMProvider from "../../jobs/JobManagerProvider";
import { birthResponse, type CheckAllResult } from "./response";

const EPHEMERAL_FLAGS = MessageFlags.Ephemeral;
const birthController = new BirthController(Database.client);
const checkQueueController = new BirthCheckQueueController(Database.client);
const gratzLogController = new BirthdayGratzLogController(Database.client);
const gratzMessageController = new GratzMessageController(Database.client);

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

async function handleGratzLogSubcommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  try {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "list") {
      const targetUser = interaction.options.getUser("user", false);
      const records = await gratzLogController.listRecent(targetUser?.id, 10);
      await respond(
        interaction,
        birthResponse.gratzLogList(records),
        { ephemeral: true },
      );
      return;
    }

    if (subcommand === "delete") {
      const targetUser = interaction.options.getUser("user", true);
      try {
        await gratzLogController.deleteMostRecentByTarget(targetUser.id);
        await respond(
          interaction,
          birthResponse.gratzLogDeleteSuccess(targetUser.id),
          { ephemeral: true },
        );
      } catch (error) {
        if (error instanceof AppError && error.code === "NOT_FOUND") {
          await respond(
            interaction,
            birthResponse.gratzLogDeleteNotFound(targetUser.id),
            { ephemeral: true },
          );
          return;
        }
        throw error;
      }
      return;
    }

    await respond(interaction, birthResponse.unexpectedError(), {
      ephemeral: true,
    });
  } catch (error) {
    if (error instanceof AppError) {
      await respond(interaction, error.userMessage, { ephemeral: true });
      return;
    }

    console.error("Ошибка при обработке /birth gratzlog", error);
    await respond(interaction, birthResponse.unexpectedError(), {
      ephemeral: true,
    });
  }
}

async function handleBirthdaySubcommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "me") {
    try {
      const record = await birthController.getOwnBirthday(interaction.user.id);
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
      const record = await birthController.getBirthday(targetUser.id);
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
      const result = await birthController.setBirthday(
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
      const result = await birthController.deleteBirthday(targetUser.id);
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
      const entries = await birthController.listBirthdays();
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

  const existing = await birthController.getBirthday(userId);
  if (existing) {
    await interaction.editReply(birthResponse.checkAlreadySet(userId));
    return;
  }

  const added = await checkQueueController.addToCheckQueue(guildId, userId);
  if (!added) {
    await interaction.editReply(birthResponse.checkAlreadyPending(userId));
    return;
  }

  try {
    await enqueueCheckMessageJob(guildId, userId);
    await interaction.editReply(birthResponse.checkEnqueued(userId));
  } catch {
    await checkQueueController.removeFromCheckQueue(guildId, userId);
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

    const existing = await birthController.getBirthday(userId);
    if (existing) {
      result.alreadySet += 1;
      continue;
    }

    const added = await checkQueueController.addToCheckQueue(guildId, userId);
    if (!added) {
      result.alreadyPending += 1;
      continue;
    }

    try {
      await enqueueCheckMessageJob(guildId, userId);
      result.added += 1;
    } catch {
      await checkQueueController.removeFromCheckQueue(guildId, userId);
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

  const records = await checkQueueController.listCheckQueue(interaction.guildId);
  await respond(interaction, birthResponse.checkQueue(records), { flags: EPHEMERAL_FLAGS });
}

async function handleDequeueSubcommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guildId) {
    await respond(interaction, "Команда доступна только на сервере", { flags: EPHEMERAL_FLAGS });
    return;
  }

  const targetUser = interaction.options.getUser("user", true);
  const removed = await checkQueueController.removeFromCheckQueue(interaction.guildId, targetUser.id);
  const message = removed
    ? birthResponse.dequeueSuccess(targetUser.id)
    : birthResponse.dequeueNotFound(targetUser.id);

  await respond(interaction, message, { flags: EPHEMERAL_FLAGS });
}

async function handleCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const subcommandGroup = interaction.options.getSubcommandGroup(false);
  const subcommand = interaction.options.getSubcommand();

  if (subcommandGroup === "gratzlog") {
    await handleGratzLogSubcommand(interaction);
    return;
  }

  if (subcommandGroup === "gratzmessage" || subcommand === "gratz") {
    await handleGratzSubcommands(interaction);
    return;
  }

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

  if (subcommand === "dequeue") {
    await handleDequeueSubcommand(interaction);
    return;
  }

  await handleBirthdaySubcommand(interaction);
}

const birthHandler = { handleCommand };

export default birthHandler;

export const GRATZ_MESSAGE_MODAL_ID = "birth:gratzmessage:create";
const GRATZ_MESSAGE_MODAL_INPUT_ID = "gratzmessage-text";

function normalizeEmojiAliases(text: string, guild: Guild | null): string {
  if (!guild) {
    return text;
  }

  return text.replace(
    /:([a-zA-Z0-9_]{2,32}):/g,
    (match, emojiName, offset, source) => {
      const prevChar = source[offset - 1];
      const suffix = source.slice(offset + match.length);

      if (prevChar === "<" || /^\d+>/.test(suffix)) {
        return match;
      }

      const emoji = guild.emojis.cache.find((item) => item.name === emojiName);
      return emoji ? emoji.toString() : match;
    },
  );
}

function mapGratzAppError(error: AppError): string {
  switch (error.code) {
    case "NOT_FOUND":
      return birthResponse.gratzMessageNotFoundError();
    case "EMPTY_VALUE":
      return birthResponse.gratzMessageTextEmptyError();
    case "INVALID_INPUT":
      return birthResponse.gratzMessageIdInvalidError();
    default:
      return birthResponse.unexpectedError();
  }
}

async function handleGratzSubcommands(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  try {
    const subcommandGroup = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();

    if (subcommandGroup === "gratzmessage") {
      if (subcommand === "create") {
        const modal = new ModalBuilder()
          .setCustomId(GRATZ_MESSAGE_MODAL_ID)
          .setTitle("Новое поздравление")
          .addComponents(
            new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId(GRATZ_MESSAGE_MODAL_INPUT_ID)
                .setLabel("Текст поздравления")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(2000),
            ),
          );

        await interaction.showModal(modal);
        return;
      }

      if (subcommand === "get") {
        const messageId = interaction.options.getString("messageid", true);
        const record = await gratzMessageController.getGratzMessage(messageId);
        await respond(interaction, birthResponse.gratzMessageById(record), { ephemeral: true });
        return;
      }

      if (subcommand === "delete") {
        const messageId = interaction.options.getString("messageid", true);
        const record = await gratzMessageController.deleteGratzMessage(messageId);
        await respond(interaction, birthResponse.gratzMessageDeleted(record.id), { ephemeral: true });
        return;
      }

      if (subcommand === "list") {
        const records = await gratzMessageController.listGratzMessages();
        await respond(interaction, birthResponse.gratzMessageList(records), { ephemeral: true });
        return;
      }

      throw new AppError("INVALID_FORMAT");
    }

    if (subcommand === "gratz") {
      const targetUser = interaction.options.getUser("user", true);
      const messageId =
        interaction.options.getString("messageid", false) ?? undefined;
      const message = await gratzMessageController.gratzUser(targetUser.id, messageId);
      await respond(
        interaction,
        normalizeEmojiAliases(message, interaction.guild),
        { ephemeral: false },
      );

      if (interaction.guildId) {
        try {
          await gratzLogController.createLog(
            interaction.guildId,
            interaction.user.id,
            targetUser.id,
          );
        } catch (error) {
          console.error("Ошибка при записи поздравления в лог", error);
        }
      }
      return;
    }

    throw new AppError("INVALID_FORMAT");
  } catch (error) {
    if (error instanceof AppError) {
      await respond(interaction, mapGratzAppError(error), { ephemeral: true });
      return;
    }

    console.error("Ошибка при обработке /birth gratz", error);
    await respond(interaction, birthResponse.unexpectedError(), { ephemeral: true });
  }
}

export async function handleGratzModalSubmit(
  interaction: ModalSubmitInteraction,
): Promise<boolean> {
  if (interaction.customId !== GRATZ_MESSAGE_MODAL_ID) {
    return false;
  }

  try {
    const text = interaction.fields.getTextInputValue(GRATZ_MESSAGE_MODAL_INPUT_ID);
    const normalizedText = normalizeEmojiAliases(text, interaction.guild);
    const record = await gratzMessageController.createGratzMessage(normalizedText);
    await interaction.reply({
      content: birthResponse.gratzMessageSaved(record.id),
      ephemeral: true,
    });
    return true;
  } catch (error) {
    if (error instanceof AppError) {
      await interaction.reply({
        content: mapGratzAppError(error),
        ephemeral: true,
      });
      return true;
    }

    console.error("Ошибка при обработке modal /birth gratzmessage create", error);
    await interaction.reply({
      content: birthResponse.unexpectedError(),
      ephemeral: true,
    });
    return true;
  }
}

