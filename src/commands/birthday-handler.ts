import type {
  ChatInputCommandInteraction,
  InteractionReplyOptions,
} from "discord.js";
import { BirthdayCommandError } from "../birthdays/errors";
import { createBirthdayCommandProcessor } from "../birthdays/processor";

const processor = createBirthdayCommandProcessor();

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
    const subcommand = interaction.options.getSubcommand();

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
