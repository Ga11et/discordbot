import type {
  ChatInputCommandInteraction,
  InteractionReplyOptions,
} from "discord.js";
import commandAccess, {
  type CommandAccessConfig,
} from "../shared/command-access";

async function replyToInteraction(
  interaction: ChatInputCommandInteraction,
  content: string,
): Promise<void> {
  const payload: InteractionReplyOptions = {
    content,
    ephemeral: true,
  };

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload);
    return;
  }

  await interaction.reply(payload);
}

async function ensureAccess(
  interaction: ChatInputCommandInteraction,
  config: CommandAccessConfig,
): Promise<boolean> {
  const accessResult = commandAccess.getInteractionAccessResult(
    interaction,
    config,
  );
  if (accessResult.allowed) {
    return true;
  }

  await replyToInteraction(
    interaction,
    commandAccess.getAccessDeniedMessage("birth", config, accessResult),
  );
  return false;
}

class BirthAccess {
  ensureAccess(
    interaction: ChatInputCommandInteraction,
    config: CommandAccessConfig,
  ): Promise<boolean> {
    return ensureAccess(interaction, config);
  }

  loadConfig(env: NodeJS.ProcessEnv = process.env): CommandAccessConfig {
    return commandAccess.loadConfig(env);
  }
}

export default new BirthAccess();
