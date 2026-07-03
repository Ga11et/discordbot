import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type Guild,
  type InteractionReplyOptions,
  type ModalActionRowComponentBuilder,
  type ModalSubmitInteraction,
} from "discord.js";
import Database from "../../db";
import BirthdayResponse from "../../modules/birthdays/response";
import BirthdayService from "../../modules/birthdays/services/birthday-service";
import GratzService from "../../modules/birthdays/services/gratz-service";
import { AppError } from "../../utils/errors";
import { BirthdayCommandProcessor } from "../../modules/birthdays/processor";
import { BirthdayGratzLogController } from "../../modules/birth/gratz-log/controller";

const birthdayService = new BirthdayService(Database.client);
const gratzService = new GratzService(Database.client);
const processor = new BirthdayCommandProcessor(birthdayService, gratzService);
const gratzLogController = new BirthdayGratzLogController(Database.client);
const birthdayResponse = new BirthdayResponse();
export const GRATZ_MESSAGE_SET_MODAL_ID = "bd:gratzmessage:create";
const GRATZ_MESSAGE_SET_MODAL_INPUT_ID = "gratzmessage-text";

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

async function handleCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  try {
    const subcommandGroup = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();

    if (subcommandGroup === "gratzmessage") {
      if (subcommand === "create") {
        const modal = new ModalBuilder()
          .setCustomId(GRATZ_MESSAGE_SET_MODAL_ID)
          .setTitle("Новое поздравление")
          .addComponents(
            new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId(GRATZ_MESSAGE_SET_MODAL_INPUT_ID)
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
        const message = await processor.getGratzMessage(messageId);
        await respond(interaction, message, { ephemeral: true });
        return;
      }

      if (subcommand === "delete") {
        const messageId = interaction.options.getString("messageid", true);
        const message = await processor.deleteGratzMessage(messageId);
        await respond(interaction, message, { ephemeral: true });
        return;
      }

      if (subcommand === "list") {
        const message = await processor.listGratzMessages();
        await respond(interaction, message, { ephemeral: true });
        return;
      }

      throw new AppError(
        "INVALID_FORMAT",
        birthdayResponse.buildUnknownGratzSubcommandError(),
      );
    }

    if (subcommand === "me") {
      const message = await processor.showOwnBirthday(interaction.user.id);
      await respond(interaction, message, { ephemeral: true });
      return;
    }

    if (subcommand === "set") {
      const dateInput = interaction.options.getString("date", true);
      const targetUser = interaction.options.getUser("user");
      const message = await processor.setBirthday(
        interaction.user.id,
        dateInput,
        targetUser?.id,
      );
      await respond(interaction, message, {
        ephemeral: targetUser?.id === interaction.user.id || !targetUser,
      });
      return;
    }

    if (subcommand === "delete") {
      const targetUser = interaction.options.getUser("user", true);
      const message = await processor.deleteBirthday(targetUser.id);
      await respond(interaction, message, { ephemeral: true });
      return;
    }

    if (subcommand === "list") {
      const list = await processor.listBirthdays();
      await respond(
        interaction,
        birthdayResponse.buildBirthdayListResponse(list.entries),
      );
      return;
    }

    if (subcommand === "gratz") {
      const targetUser = interaction.options.getUser("user", true);
      const messageId =
        interaction.options.getString("messageid", false) ?? undefined;
      const message = await processor.gratzUser(targetUser.id, messageId);
      await respond(
        interaction,
        normalizeEmojiAliases(message, interaction.guild),
        {
          ephemeral: false,
        },
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

    throw new AppError(
      "INVALID_FORMAT",
      birthdayResponse.buildUnknownSubcommandError(),
    );
  } catch (error) {
    if (error instanceof AppError) {
      await respond(interaction, error.userMessage, { ephemeral: true });
      return;
    }

    console.error("Ошибка при обработке /bd", error);
    await respond(interaction, birthdayResponse.buildUnexpectedError(), {
      ephemeral: true,
    });
  }
}

async function handleModalSubmit(
  interaction: ModalSubmitInteraction,
): Promise<boolean> {
  if (interaction.customId !== GRATZ_MESSAGE_SET_MODAL_ID) {
    return false;
  }

  try {
    const text = interaction.fields.getTextInputValue(
      GRATZ_MESSAGE_SET_MODAL_INPUT_ID,
    );
    const normalizedText = normalizeEmojiAliases(text, interaction.guild);
    const message = await processor.createGratzMessage(normalizedText);
    await interaction.reply({
      content: message,
      ephemeral: true,
    });
    return true;
  } catch (error) {
    if (error instanceof AppError) {
      await interaction.reply({
        content: error.userMessage,
        ephemeral: true,
      });
      return true;
    }

    console.error("Ошибка при обработке modal /bd gratzmessage set", error);
    await interaction.reply({
      content: birthdayResponse.buildUnexpectedError(),
      ephemeral: true,
    });
    return true;
  }
}

const birthdayHandler = {
  GRATZ_MESSAGE_SET_MODAL_ID,
  handleCommand,
  handleModalSubmit,
};

export default birthdayHandler;
