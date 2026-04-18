import type {
  ChatInputCommandInteraction,
  InteractionReplyOptions,
  ModalActionRowComponentBuilder,
  ModalSubmitInteraction,
} from "discord.js";
import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { BirthdayCommandError } from "../birthdays/errors";
import { createBirthdayCommandProcessor } from "../birthdays/processor";

const processor = createBirthdayCommandProcessor();
export const GRATZ_MESSAGE_SET_MODAL_ID = "bd:gratzmessage:create";
const GRATZ_MESSAGE_SET_MODAL_INPUT_ID = "gratzmessage-text";

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

export async function handleBirthdayCommand(
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

      throw new BirthdayCommandError(
        "INVALID_FORMAT",
        "Неизвестная подкоманда gratzmessage",
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

    if (subcommand === "list") {
      const list = await processor.listBirthdays();
      if (list.entries.length === 0) {
        await respond(interaction, "Пока никто не добавил дату рождения", {
          ephemeral: false,
        });
        return;
      }

      const lines = list.entries.map(
        (entry, index) =>
          `${index + 1}. <@${entry.userId}> — ${entry.birthdayLabel}`,
      );
      await respond(interaction, lines.join("\n"));
      return;
    }

    if (subcommand === "gratz") {
      const targetUser = interaction.options.getUser("user", true);
      const message = await processor.gratzUser(targetUser.id);
      await respond(interaction, message, { ephemeral: false });
      return;
    }

    throw new BirthdayCommandError("INVALID_FORMAT", "Неизвестная подкоманда");
  } catch (error) {
    if (error instanceof BirthdayCommandError) {
      await respond(interaction, error.userMessage, { ephemeral: true });
      return;
    }

    console.error("Ошибка при обработке /bd", error);
    await respond(interaction, "Что-то пошло не так. Попробуй позже", {
      ephemeral: true,
    });
  }
}

export async function handleBirthdayModalSubmit(
  interaction: ModalSubmitInteraction,
): Promise<boolean> {
  if (interaction.customId !== GRATZ_MESSAGE_SET_MODAL_ID) {
    return false;
  }

  try {
    const text = interaction.fields.getTextInputValue(
      GRATZ_MESSAGE_SET_MODAL_INPUT_ID,
    );
    const message = await processor.createGratzMessage(text);
    await interaction.reply({
      content: message,
      ephemeral: true,
    });
    return true;
  } catch (error) {
    if (error instanceof BirthdayCommandError) {
      await interaction.reply({
        content: error.userMessage,
        ephemeral: true,
      });
      return true;
    }

    console.error("Ошибка при обработке modal /bd gratzmessage set", error);
    await interaction.reply({
      content: "Что-то пошло не так. Попробуй позже",
      ephemeral: true,
    });
    return true;
  }
}
