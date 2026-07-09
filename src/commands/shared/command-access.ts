import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
} from "discord.js";

export type CommandRole = "GUEST" | "TESTER" | "ADMIN";

export interface CommandRoleConfig {
  adminRoleIds: string[];
  adminUserIds: string[];
  testerRoleIds: string[];
  testerUserIds: string[];
}

export interface CommandAccessConfig {
  allowedChannelIds: string[];
  roleConfig: CommandRoleConfig;
}

export interface CommandAccessSubject {
  userId: string | null;
  roleIds: readonly string[];
}

export type CommandAccessFailureReason =
  | "NOT_IN_GUILD"
  | "CHANNEL_NOT_ALLOWED"
  | "ROLE_NOT_ALLOWED"
  | "UNKNOWN_COMMAND";

export interface CommandInteractionAccessResult {
  allowed: boolean;
  commandId: string | null;
  reason: CommandAccessFailureReason | null;
}

export type SupportedAccessInteraction =
  | ButtonInteraction
  | ChatInputCommandInteraction
  | ModalSubmitInteraction;

export const TESTER_ALLOWED_COMMAND_IDS: readonly string[] = [
  "birth.gratzmessage.get",
  "birth.gratzmessage.list",
  "birth.get",
  "kickqueue.list",
];

export const PUBLIC_COMMAND_IDS = new Set([
  "birth.me",
  "birth.set",
]);

export function parseIds(rawIds: string | undefined): string[] {
  return [
    ...new Set(
      (rawIds ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
}

function extractInteractionRoleIds(
  interaction: SupportedAccessInteraction,
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

function loadRoleConfig(
  env: NodeJS.ProcessEnv = process.env,
): CommandRoleConfig {
  return {
    adminRoleIds: parseIds(env.BD_ROLE_ADMIN_IDS),
    adminUserIds: parseIds(env.BD_USER_ADMIN_IDS),
    testerRoleIds: parseIds(env.BD_ROLE_TESTER_IDS),
    testerUserIds: parseIds(env.BD_USER_TESTER_IDS),
  };
}

function loadConfig(env: NodeJS.ProcessEnv = process.env): CommandAccessConfig {
  const allowedChannelIdsRaw = env.BD_ALLOWED_CHANNEL_ID?.trim();
  if (!allowedChannelIdsRaw) {
    throw new Error("BD_ALLOWED_CHANNEL_ID is not set");
  }

  const allowedChannelIds = parseIds(allowedChannelIdsRaw);
  if (allowedChannelIds.length === 0) {
    throw new Error(
      "BD_ALLOWED_CHANNEL_ID must contain at least one channel id",
    );
  }

  return {
    allowedChannelIds,
    roleConfig: loadRoleConfig(env),
  };
}

function getAccessSubject(
  interaction: SupportedAccessInteraction,
): CommandAccessSubject {
  return {
    userId: interaction.user?.id ?? null,
    roleIds: extractInteractionRoleIds(interaction),
  };
}

function resolveRoles(
  subject: CommandAccessSubject,
  config: CommandRoleConfig,
): Set<CommandRole> {
  const resolvedRoles = new Set<CommandRole>();

  const hasAdminRoleId = config.adminRoleIds.some((roleId) =>
    subject.roleIds.includes(roleId),
  );
  const hasTesterRoleId = config.testerRoleIds.some((roleId) =>
    subject.roleIds.includes(roleId),
  );

  if (hasAdminRoleId) {
    resolvedRoles.add("ADMIN");
  }

  if (hasTesterRoleId) {
    resolvedRoles.add("TESTER");
  }

  if (subject.userId) {
    if (config.adminUserIds.includes(subject.userId)) {
      resolvedRoles.add("ADMIN");
    }

    if (config.testerUserIds.includes(subject.userId)) {
      resolvedRoles.add("TESTER");
    }
  }

  if (resolvedRoles.size === 0) {
    resolvedRoles.add("GUEST");
  }

  return resolvedRoles;
}

function isPublicCommandId(commandId: string): boolean {
  return PUBLIC_COMMAND_IDS.has(commandId);
}

function isChannelAllowed(
  channelId: string | null,
  allowedChannelIds: readonly string[],
): boolean {
  return Boolean(channelId && allowedChannelIds.includes(channelId));
}

function formatAllowedChannels(channelIds: readonly string[]): string {
  const channelMentions = channelIds.map((channelId) => `<#${channelId}>`);

  if (channelMentions.length === 1) {
    return `в канале ${channelMentions[0]}`;
  }

  return `в каналах: ${channelMentions.join(", ")}`;
}

function hasCommandAccess(
  subject: CommandAccessSubject,
  config: CommandRoleConfig,
  commandId: string,
  testerAllowedCommandIds: readonly string[] = TESTER_ALLOWED_COMMAND_IDS,
): boolean {
  const roles = resolveRoles(subject, config);

  if (roles.has("ADMIN")) {
    return true;
  }

  if (isPublicCommandId(commandId)) {
    return true;
  }

  if (roles.has("TESTER")) {
    return testerAllowedCommandIds.includes(commandId);
  }

  return false;
}

function getInteractionAccessResult(
  interaction: SupportedAccessInteraction,
  config: CommandAccessConfig,
  testerAllowedCommandIds: readonly string[] = TESTER_ALLOWED_COMMAND_IDS,
): CommandInteractionAccessResult {
  if (!interaction.inGuild()) {
    return {
      allowed: false,
      commandId: null,
      reason: "NOT_IN_GUILD",
    };
  }

  const commandId = getCommandId(interaction);
  if (!commandId) {
    return {
      allowed: false,
      commandId: null,
      reason: "UNKNOWN_COMMAND",
    };
  }

  if (!isChannelAllowed(interaction.channelId, config.allowedChannelIds)) {
    return {
      allowed: false,
      commandId,
      reason: "CHANNEL_NOT_ALLOWED",
    };
  }

  const subject = getAccessSubject(interaction);
  if (
    hasCommandAccess(
      subject,
      config.roleConfig,
      commandId,
      testerAllowedCommandIds,
    )
  ) {
    return {
      allowed: true,
      commandId,
      reason: null,
    };
  }

  return {
    allowed: false,
    commandId,
    reason: "ROLE_NOT_ALLOWED",
  };
}

function getAccessDeniedMessage(
  commandName: string,
  config: CommandAccessConfig,
  accessResult: CommandInteractionAccessResult,
): string {
  const allowedChannels = formatAllowedChannels(config.allowedChannelIds);
  const baseMessage = `Команды /${commandName} доступны только ${allowedChannels}`;

  if (accessResult.commandId && isPublicCommandId(accessResult.commandId)) {
    return baseMessage;
  }

  return `${baseMessage} и пользователям с правами TESTER или ADMIN`;
}

function getChatInputCommandId(
  interaction: ChatInputCommandInteraction,
): string {
  const subcommandGroup = interaction.options.getSubcommandGroup(false);
  const subcommand = interaction.options.getSubcommand();

  if (subcommandGroup) {
    return `${interaction.commandName}.${subcommandGroup}.${subcommand}`;
  }

  return `${interaction.commandName}.${subcommand}`;
}

function getModalCommandId(interaction: ModalSubmitInteraction): string | null {
  const parts = interaction.customId
    .split(":")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return null;
  }

  return parts.join(".");
}

function getCommandId(interaction: SupportedAccessInteraction): string | null {
  if (
    typeof interaction.isChatInputCommand === "function" &&
    interaction.isChatInputCommand()
  ) {
    return getChatInputCommandId(interaction);
  }

  if (
    typeof interaction.isModalSubmit === "function" &&
    interaction.isModalSubmit()
  ) {
    return getModalCommandId(interaction);
  }

  return null;
}

const commandAccess = {
  formatAllowedChannels,
  getAccessDeniedMessage,
  getAccessSubject,
  getCommandId,
  getChatInputCommandId,
  getInteractionAccessResult,
  hasCommandAccess,
  isChannelAllowed,
  isPublicCommandId,
  loadConfig,
  loadRoleConfig,
  parseIds,
  resolveRoles,
  TESTER_ALLOWED_COMMAND_IDS,
  PUBLIC_COMMAND_IDS,
};

export default commandAccess;
