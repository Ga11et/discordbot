import {
  MessageFlags,
  type ChatInputCommandInteraction,
  type InteractionReplyOptions,
} from "discord.js";
import commandAccess, {
  type CommandAccessConfig,
} from "../shared/command-access";

const EPHEMERAL_FLAGS = MessageFlags.Ephemeral;

function loadConfig(env: NodeJS.ProcessEnv = process.env): CommandAccessConfig {
  return commandAccess.loadConfig(env);
}

async function replyToInteraction(
  interaction: ChatInputCommandInteraction,
  content: string,
): Promise<void> {
  const payload: InteractionReplyOptions = {
    content,
    flags: EPHEMERAL_FLAGS,
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
    commandAccess.getAccessDeniedMessage("jobs", config, accessResult),
  );
  return false;
}

const jobsAccess = {
  ensureAccess,
  loadConfig,
};

export default jobsAccess;
