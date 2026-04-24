import type {
  ChatInputCommandInteraction,
  InteractionReplyOptions,
  ModalSubmitInteraction,
} from "discord.js";

export interface BirthdayAccessConfig {
  allowedChannelIds: string[];
  allowedRoleIds: string[];
}

export interface BirthdayAccessPolicy {
  requireRole: boolean;
}

const DEFAULT_BIRTHDAY_ACCESS_POLICY: BirthdayAccessPolicy = {
  requireRole: true,
};

const PUBLIC_BD_SUBCOMMANDS = new Set(["me", "set", "list"]);

type BirthdayInteraction = ChatInputCommandInteraction | ModalSubmitInteraction;

function isPublicBirthdaySubcommand(
  interaction: ChatInputCommandInteraction,
): boolean {
  if (interaction.options.getSubcommandGroup(false)) {
    return false;
  }

  const subcommand = interaction.options.getSubcommand();
  return PUBLIC_BD_SUBCOMMANDS.has(subcommand);
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

function parseChannelIds(rawChannelIds: string): string[] {
  return [
    ...new Set(
      rawChannelIds
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
}

function formatAllowedChannels(channelIds: string[]): string {
  const channelMentions = channelIds.map((channelId) => `<#${channelId}>`);

  if (channelMentions.length === 1) {
    return `в канале ${channelMentions[0]}`;
  }

  return `в каналах: ${channelMentions.join(", ")}`;
}

function loadConfig(
  env: NodeJS.ProcessEnv = process.env,
): BirthdayAccessConfig {
  const allowedChannelIdsRaw = env.BD_ALLOWED_CHANNEL_ID?.trim();
  if (!allowedChannelIdsRaw) {
    throw new Error("BD_ALLOWED_CHANNEL_ID is not set");
  }

  const allowedChannelIds = parseChannelIds(allowedChannelIdsRaw);
  if (allowedChannelIds.length === 0) {
    throw new Error(
      "BD_ALLOWED_CHANNEL_ID must contain at least one channel id",
    );
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
    allowedChannelIds,
    allowedRoleIds,
  };
}

function extractInteractionRoleIds(interaction: BirthdayInteraction): string[] {
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

function hasBirthdayAccess(
  interaction: BirthdayInteraction,
  config: BirthdayAccessConfig,
  policy: BirthdayAccessPolicy = DEFAULT_BIRTHDAY_ACCESS_POLICY,
): boolean {
  if (!interaction.inGuild()) {
    return false;
  }

  const channelId = interaction.channelId;
  if (!channelId || !config.allowedChannelIds.includes(channelId)) {
    return false;
  }

  if (!policy.requireRole) {
    return true;
  }

  const userRoleIds = extractInteractionRoleIds(interaction);
  return config.allowedRoleIds.some((roleId) => userRoleIds.includes(roleId));
}

function accessDeniedMessage(
  config: BirthdayAccessConfig,
  policy: BirthdayAccessPolicy,
): string {
  if (!policy.requireRole) {
    return `Команды /bd доступны только ${formatAllowedChannels(config.allowedChannelIds)}`;
  }

  const roleMentions = config.allowedRoleIds.map((roleId) => `<@&${roleId}>`);
  return `Команды /bd доступны только ${formatAllowedChannels(config.allowedChannelIds)} и для ролей: ${roleMentions.join(", ")}`;
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
  config: BirthdayAccessConfig,
  policy: BirthdayAccessPolicy = DEFAULT_BIRTHDAY_ACCESS_POLICY,
): Promise<boolean> {
  if (hasBirthdayAccess(interaction, config, policy)) {
    return true;
  }

  await replyToInteraction(interaction, accessDeniedMessage(config, policy));
  return false;
}

const birthdayAccess = {
  ensureAccess,
  hasAccess: hasBirthdayAccess,
  isPublicSubcommand: isPublicBirthdaySubcommand,
  loadConfig,
};

export default birthdayAccess;
