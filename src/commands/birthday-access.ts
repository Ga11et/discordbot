import type {
  ChatInputCommandInteraction,
  InteractionReplyOptions,
  ModalSubmitInteraction,
} from "discord.js";
import commandAccess, { type CommandAccessConfig } from "./command-access";

type BirthdayInteraction = ChatInputCommandInteraction | ModalSubmitInteraction;

function loadConfig(env: NodeJS.ProcessEnv = process.env): CommandAccessConfig {
  return commandAccess.loadConfig(env);
}

async function replyToInteraction(
  interaction: BirthdayInteraction,
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
  interaction: BirthdayInteraction,
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
    commandAccess.getAccessDeniedMessage("bd", config, accessResult),
  );
  return false;
}

const birthdayAccess = {
  ensureAccess,
  loadConfig,
};

export default birthdayAccess;
