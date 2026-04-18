import type {
  ChatInputCommandInteraction,
  InteractionReplyOptions,
  ModalSubmitInteraction,
} from "discord.js";

export interface BirthdayAccessConfig {
  allowedChannelId: string;
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

export function isPublicBirthdaySubcommand(
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

export function loadBirthdayAccessConfig(
  env: NodeJS.ProcessEnv = process.env,
): BirthdayAccessConfig {
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

export function hasBirthdayAccess(
  interaction: BirthdayInteraction,
  config: BirthdayAccessConfig,
  policy: BirthdayAccessPolicy = DEFAULT_BIRTHDAY_ACCESS_POLICY,
): boolean {
  if (!interaction.inGuild()) {
    return false;
  }

  if (interaction.channelId !== config.allowedChannelId) {
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
    return `Команды /bd доступны только в канале <#${config.allowedChannelId}>`;
  }

  const roleMentions = config.allowedRoleIds.map((roleId) => `<@&${roleId}>`);
  return `Команды /bd доступны только в канале <#${config.allowedChannelId}> и для ролей: ${roleMentions.join(", ")}`;
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

export async function ensureBirthdayAccess(
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
