import {
  type ChatInputCommandInteraction,
  type InteractionReplyOptions,
} from "discord.js";
import Database from "../../db";
import { AppError } from "../../utils/errors";
import { BirthController } from "../../modules/birth/controller";
import { birthResponse } from "./response";

const controller = new BirthController(Database.client);

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

async function handleCommand(
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

const birthHandler = { handleCommand };

export default birthHandler;
