import type {
  ChatInputCommandInteraction,
  InteractionReplyOptions,
} from "discord.js";

export interface KickQueueAccessConfig {
  allowedChannelId: string;
  allowedRoleIds: string[];
}

function parseRoleIds(rawRoleIds: string): string[] {
  return [
    ...new Set(
      rawRoleIds
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
}

export function loadKickQueueAccessConfig(
  env: NodeJS.ProcessEnv = process.env,
): KickQueueAccessConfig {
  const allowedChannelId = env.BD_ALLOWED_CHANNEL_ID?.trim();
  if (!allowedChannelId) {
    throw new Error("BD_ALLOWED_CHANNEL_ID is not set");
  }

  const allowedRoleIdsRaw = env.BD_ALLOWED_ROLE_IDS?.trim();
  if (!allowedRoleIdsRaw) {
    throw new Error("BD_ALLOWED_ROLE_IDS is not set");
  }

  const allowedRoleIds = parseRoleIds(allowedRoleIdsRaw);
  if (allowedRoleIds.length === 0) {
    throw new Error("BD_ALLOWED_ROLE_IDS must contain at least one role id");
  }

  return {
    allowedChannelId,
    allowedRoleIds,
  };
}

function extractInteractionRoleIds(
  interaction: ChatInputCommandInteraction,
): string[] {
  const member = interaction.member;
  if (!member || typeof member !== "object" || !("roles" in member)) {
    return [];
  }

  const roles = member.roles;
  if (Array.isArray(roles)) {
    return roles;
  }

  if (
    typeof roles === "object" &&
    roles !== null &&
    "cache" in roles &&
    roles.cache instanceof Map
  ) {
    return [...roles.cache.keys()];
  }

  return [];
}

export function hasKickQueueAccess(
  interaction: ChatInputCommandInteraction,
  config: KickQueueAccessConfig,
): boolean {
  if (!interaction.inGuild()) {
    return false;
  }

  if (interaction.channelId !== config.allowedChannelId) {
    return false;
  }

  const userRoleIds = extractInteractionRoleIds(interaction);
  return config.allowedRoleIds.some((roleId) => userRoleIds.includes(roleId));
}

function accessDeniedMessage(config: KickQueueAccessConfig): string {
  const roleMentions = config.allowedRoleIds.map((roleId) => `<@&${roleId}>`);
  return `Команды /kickqueue доступны только в канале <#${config.allowedChannelId}> и для ролей: ${roleMentions.join(", ")}`;
}

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

export async function ensureKickQueueAccess(
  interaction: ChatInputCommandInteraction,
  config: KickQueueAccessConfig,
): Promise<boolean> {
  if (hasKickQueueAccess(interaction, config)) {
    return true;
  }

  await replyToInteraction(interaction, accessDeniedMessage(config));
  return false;
}
