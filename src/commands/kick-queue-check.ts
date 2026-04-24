import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type ButtonInteraction,
  type MessageCreateOptions,
  type User,
} from "discord.js";
import {
  KickQueueService,
  kickQueueService,
} from "../members/kick-queue-service";

const KICK_QUEUE_BUTTON_PREFIX = "kickqueue";
const STAY_ACTION = "stay";
const IGNORE_ACTION = "ignore";
const EPHEMERAL_FLAGS = MessageFlags.Ephemeral;

interface ParsedKickQueueButtonId {
  action: typeof STAY_ACTION | typeof IGNORE_ACTION;
  guildId: string;
  userId: string;
}

interface KickQueueMessageOptions {
  ignored?: boolean;
  accepted?: boolean;
  unavailable?: boolean;
}

function createButtonCustomId(
  action: typeof STAY_ACTION | typeof IGNORE_ACTION,
  guildId: string,
  userId: string,
): string {
  return `${KICK_QUEUE_BUTTON_PREFIX}:${action}:${guildId}:${userId}`;
}

function parseButtonCustomId(customId: string): ParsedKickQueueButtonId | null {
  const [prefix, action, guildId, userId] = customId.split(":");
  if (
    prefix !== KICK_QUEUE_BUTTON_PREFIX ||
    !guildId ||
    !userId ||
    (action !== STAY_ACTION && action !== IGNORE_ACTION)
  ) {
    return null;
  }

  return {
    action,
    guildId,
    userId,
  };
}

function buildKickQueueMessageContent(
  options: KickQueueMessageOptions = {},
): string {
  const parts = [
    "Вы добавлены в очередь на кик с сервера.",
    "Если вы не ответите на это сообщение, позже можете быть кикнуты с сервера.",
  ];

  if (options.ignored) {
    parts.push(
      '> **Предложение остаться было проигнорировано. Кнопка "Остаться" всё ещё доступна.**',
    );
  } else if (options.accepted) {
    parts.push(
      "> **Вы выбрали остаться на сервере и были удалены из очереди на кик.**",
    );
  } else if (options.unavailable) {
    parts.push("> **Это предложение уже неактуально.**");
  } else {
    parts.push(
      '> **Нажмите кнопку "Остаться", если хотите остаться на сервере.**',
    );
  }

  return parts.join("\n");
}

function buildKickQueueMessageComponents(
  guildId: string,
  userId: string,
  hideIgnoreButton: boolean = false,
): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(createButtonCustomId(STAY_ACTION, guildId, userId))
      .setLabel("Остаться")
      .setStyle(ButtonStyle.Success),
  );

  if (!hideIgnoreButton) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(createButtonCustomId(IGNORE_ACTION, guildId, userId))
        .setLabel("Игнорировать")
        .setStyle(ButtonStyle.Secondary),
    );
  }

  return [row];
}

async function sendCheckMessage(user: User, guildId: string): Promise<void> {
  const payload: MessageCreateOptions = {
    content: buildKickQueueMessageContent(),
    components: buildKickQueueMessageComponents(guildId, user.id),
  };

  await user.send(payload);
}

async function handleButtonInteraction(
  interaction: ButtonInteraction,
  service: KickQueueService = kickQueueService,
): Promise<boolean> {
  const parsed = parseButtonCustomId(interaction.customId);
  if (!parsed) {
    return false;
  }

  if (interaction.user.id !== parsed.userId) {
    await interaction.reply({
      content: "Эта кнопка предназначена для другого пользователя.",
      flags: EPHEMERAL_FLAGS,
    });
    return true;
  }

  if (parsed.action === IGNORE_ACTION) {
    await interaction.update({
      content: buildKickQueueMessageContent({ ignored: true }),
      components: buildKickQueueMessageComponents(
        parsed.guildId,
        parsed.userId,
        true,
      ),
    });
    return true;
  }

  const removed = await service.removePendingKickUser(
    parsed.guildId,
    parsed.userId,
  );

  await interaction.update({
    content: buildKickQueueMessageContent(
      removed ? { accepted: true } : { unavailable: true },
    ),
    components: [],
  });
  return true;
}

const kickQueueCheck = {
  handleButtonInteraction,
  sendCheckMessage,
};

export default kickQueueCheck;
