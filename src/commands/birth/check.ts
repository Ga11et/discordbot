import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type MessageCreateOptions,
  type ModalActionRowComponentBuilder,
  type User,
} from "discord.js";
import Database from "../../db";
import { BirthController } from "../../modules/birth/controller";
import { dateUtils } from "../../utils/date-utils";

export const BIRTH_BUTTON_PREFIX = "birth";
const INPUT_ACTION = "input";
const CONFIRM_ACTION = "confirm";

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const DAYS_PER_MONTH: Record<number, number> = {
  1: 31, 2: 29, 3: 31, 4: 30, 5: 31, 6: 30,
  7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31,
};

const MONTH_INPUT_FIELD_ID = "birth-month-input";
const DAY_INPUT_FIELD_ID = "birth-day-input";

const birthController = new BirthController(Database.client);

type BirthAction = typeof INPUT_ACTION | typeof CONFIRM_ACTION;

interface ParsedBirthCustomId {
  action: BirthAction;
  guildId: string;
  userId: string;
}

function createInputButtonCustomId(guildId: string, userId: string): string {
  return `${BIRTH_BUTTON_PREFIX}:${INPUT_ACTION}:${guildId}:${userId}`;
}

function createModalCustomId(guildId: string, userId: string): string {
  return `${BIRTH_BUTTON_PREFIX}:${CONFIRM_ACTION}:${guildId}:${userId}`;
}

export function parseBirthCustomId(customId: string): ParsedBirthCustomId | null {
  const parts = customId.split(":");
  if (parts.length < 4 || parts[0] !== BIRTH_BUTTON_PREFIX) {
    return null;
  }

  const [, action, guildId, userId] = parts;
  if (
    !guildId ||
    !userId ||
    (action !== INPUT_ACTION && action !== CONFIRM_ACTION)
  ) {
    return null;
  }

  return { action: action as BirthAction, guildId, userId };
}

function buildBirthCheckMessageContent(): string {
  return [
    "🎂 **Привет!**",
    "",
    "На сервере **Julianne`s** хранятся дни рождения участников, чтобы поздравлять тебя в этот день 🎉",
    "",
    "Пожалуйста, укажи свой день рождения:",
    "",
    "> Нажми кнопку **«Указать дату»** и введи месяц и день",
  ].join("\n");
}

function buildBirthCheckMessageComponents(
  guildId: string,
  userId: string,
): ActionRowBuilder<ButtonBuilder>[] {
  const button = new ButtonBuilder()
    .setCustomId(createInputButtonCustomId(guildId, userId))
    .setLabel("Указать дату")
    .setStyle(ButtonStyle.Primary);

  return [new ActionRowBuilder<ButtonBuilder>().addComponents(button)];
}

async function sendCheckMessage(user: User, guildId: string): Promise<void> {
  const payload: MessageCreateOptions = {
    content: buildBirthCheckMessageContent(),
    components: buildBirthCheckMessageComponents(guildId, user.id),
  };

  await user.send(payload);
}

async function handleButtonInteraction(
  interaction: ButtonInteraction,
): Promise<boolean> {
  const parsed = parseBirthCustomId(interaction.customId);
  if (!parsed || parsed.action !== INPUT_ACTION) {
    return false;
  }

  if (interaction.user.id !== parsed.userId) {
    await interaction.reply({
      content: "Эта кнопка предназначена для другого пользователя.",
      ephemeral: true,
    });
    return true;
  }

  const modal = new ModalBuilder()
    .setCustomId(createModalCustomId(parsed.guildId, parsed.userId))
    .setTitle("Укажи дату рождения")
    .addComponents(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(MONTH_INPUT_FIELD_ID)
          .setLabel("Месяц (число от 1 до 12)")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(2)
          .setPlaceholder("Например: 3"),
      ),
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(DAY_INPUT_FIELD_ID)
          .setLabel("День (число)")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(2)
          .setPlaceholder("Например: 15"),
      ),
    );

  await interaction.showModal(modal);
  return true;
}

async function handleModalInteraction(
  interaction: ModalSubmitInteraction,
): Promise<boolean> {
  const parsed = parseBirthCustomId(interaction.customId);
  if (!parsed || parsed.action !== CONFIRM_ACTION) {
    return false;
  }

  if (interaction.user.id !== parsed.userId) {
    await interaction.reply({
      content: "Это действие предназначено для другого пользователя.",
      ephemeral: true,
    });
    return true;
  }

  const { guildId, userId } = parsed;
  const monthInput = interaction.fields.getTextInputValue(MONTH_INPUT_FIELD_ID).trim();
  const dayInput = interaction.fields.getTextInputValue(DAY_INPUT_FIELD_ID).trim();
  const monthNum = parseInt(monthInput, 10);
  const dayNum = parseInt(dayInput, 10);

  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    await interaction.reply({
      content: "Некорректный месяц. Укажи число от 1 до 12.",
      ephemeral: true,
    });
    return true;
  }

  if (isNaN(dayNum) || dayNum < 1) {
    await interaction.reply({
      content: "Некорректный день. Укажи число от 1 до 31.",
      ephemeral: true,
    });
    return true;
  }

  const maxDays = DAYS_PER_MONTH[monthNum] ?? 31;
  if (dayNum > maxDays) {
    await interaction.reply({
      content: `В ${MONTHS[monthNum - 1]} максимум ${maxDays} дней. Попробуй ещё раз.`,
      ephemeral: true,
    });
    return true;
  }

  const dd = String(dayNum).padStart(2, "0");
  const mm = String(monthNum).padStart(2, "0");
  const dateInput = `${dd}.${mm}`;

  try {
    await birthController.setBirthday(userId, dateInput);
    await birthController.removeFromCheckQueue(guildId, userId);

    const label = dateUtils.formatDayMonth(
      dateUtils.parseDayMonth(dateInput),
    );

    await interaction.reply({
      content: `✅ **Дата рождения сохранена:** ${label}\n\nСпасибо! Теперь тебя будут поздравлять на сервере 🎉`,
    });
  } catch {
    await interaction.reply({
      content: "Что-то пошло не так при сохранении даты рождения. Попробуй ещё раз или установи дату командой /birth set.",
      ephemeral: true,
    });
  }

  return true;
}

const birthCheck = {
  sendCheckMessage,
  handleButtonInteraction,
  handleModalInteraction,
};

export default birthCheck;
