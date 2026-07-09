import type {
  ChatInputCommandInteraction,
  InteractionReplyOptions,
  ModalSubmitInteraction,
} from "discord.js";
import commandAccess, {
  type CommandAccessConfig,
} from "../shared/command-access";

type BirthInteraction = ChatInputCommandInteraction | ModalSubmitInteraction;

async function replyToInteraction(
  interaction: BirthInteraction,
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
  interaction: BirthInteraction,
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
    interaction: BirthInteraction,
    config: CommandAccessConfig,
  ): Promise<boolean> {
    return ensureAccess(interaction, config);
  }

  loadConfig(env: NodeJS.ProcessEnv = process.env): CommandAccessConfig {
    return commandAccess.loadConfig(env);
  }
}

export default new BirthAccess();
