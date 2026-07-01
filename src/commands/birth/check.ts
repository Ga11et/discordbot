import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
  type MessageCreateOptions,
  type User,
} from "discord.js";
import Database from "../../db";
import { BirthController } from "../../modules/birth/controller";
import { dateUtils } from "../../utils/date-utils";

export const BIRTH_BUTTON_PREFIX = "birth";
const MONTH_SELECT_ACTION = "month";
const DAY_SELECT_ACTION = "day";
const CONFIRM_ACTION = "confirm";

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const DAYS_PER_MONTH: Record<number, number> = {
  1: 31, 2: 29, 3: 31, 4: 30, 5: 31, 6: 30,
  7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31,
};

const NO_VALUE = "0";

const birthController = new BirthController(Database.client);

interface ParsedBirthCustomId {
  action: typeof MONTH_SELECT_ACTION | typeof DAY_SELECT_ACTION | typeof CONFIRM_ACTION;
  guildId: string;
  userId: string;
  month: string;
  day: string;
}

function createMonthSelectCustomId(guildId: string, userId: string): string {
  return `${BIRTH_BUTTON_PREFIX}:${MONTH_SELECT_ACTION}:${guildId}:${userId}`;
}

function createDaySelectCustomId(guildId: string, userId: string): string {
  return `${BIRTH_BUTTON_PREFIX}:${DAY_SELECT_ACTION}:${guildId}:${userId}`;
}

function createConfirmButtonCustomId(
  guildId: string,
  userId: string,
  month: string,
  day: string,
): string {
  return `${BIRTH_BUTTON_PREFIX}:${CONFIRM_ACTION}:${guildId}:${userId}:${month}:${day}`;
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
    (action !== MONTH_SELECT_ACTION && action !== DAY_SELECT_ACTION && action !== CONFIRM_ACTION)
  ) {
    return null;
  }

  const month = parts[4] ?? NO_VALUE;
  const day = parts[5] ?? NO_VALUE;

  return { action: action as ParsedBirthCustomId["action"], guildId, userId, month, day };
}

function buildMonthSelectMenu(
  guildId: string,
  userId: string,
  selectedMonth: string,
): ActionRowBuilder<StringSelectMenuBuilder> {
  const options = MONTHS.map((name, i) => {
    const value = String(i + 1);
    return new StringSelectMenuOptionBuilder()
      .setLabel(name)
      .setValue(value)
      .setDefault(selectedMonth === value);
  });

  const select = new StringSelectMenuBuilder()
    .setCustomId(createMonthSelectCustomId(guildId, userId))
    .setPlaceholder("Выбери месяц")
    .addOptions(options);

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

function buildDaySelectMenu(
  guildId: string,
  userId: string,
  selectedMonth: string,
  selectedDay: string,
): ActionRowBuilder<StringSelectMenuBuilder> {
  const month = parseInt(selectedMonth, 10);
  const maxDays = month >= 1 && month <= 12 ? DAYS_PER_MONTH[month] : 31;

  const options: StringSelectMenuOptionBuilder[] = [];
  for (let d = 1; d <= maxDays; d++) {
    const value = String(d);
    options.push(
      new StringSelectMenuOptionBuilder()
        .setLabel(String(d).padStart(2, "0"))
        .setValue(value)
        .setDefault(selectedDay === value),
    );
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(createDaySelectCustomId(guildId, userId))
    .setPlaceholder("Выбери день")
    .addOptions(options);

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

function buildConfirmButton(
  guildId: string,
  userId: string,
  month: string,
  day: string,
): ActionRowBuilder<ButtonBuilder> {
  const isReady = month !== NO_VALUE && day !== NO_VALUE;

  const button = new ButtonBuilder()
    .setCustomId(createConfirmButtonCustomId(guildId, userId, month, day))
    .setLabel("Подтвердить")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(!isReady);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(button);
}

function buildBirthCheckMessageContent(): string {
  return [
    "🎂 **Привет!**",
    "",
    "На сервере **Julianne`s** хранятся дни рождения участников, чтобы поздравлять тебя в этот день 🎉",
    "",
    "Пожалуйста, укажи свой день рождения (месяц и день):",
    "",
    "> Выбери месяц и день из меню ниже, затем нажми **«Подтвердить»**",
  ].join("\n");
}

function buildBirthCheckMessageComponents(
  guildId: string,
  userId: string,
  month: string = NO_VALUE,
  day: string = NO_VALUE,
): ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] {
  return [
    buildMonthSelectMenu(guildId, userId, month),
    buildDaySelectMenu(guildId, userId, month, day),
    buildConfirmButton(guildId, userId, month, day),
  ];
}

async function sendCheckMessage(user: User, guildId: string): Promise<void> {
  const payload: MessageCreateOptions = {
    content: buildBirthCheckMessageContent(),
    components: buildBirthCheckMessageComponents(guildId, user.id),
  };

  await user.send(payload);
}

async function handleSelectInteraction(
  interaction: StringSelectMenuInteraction,
): Promise<boolean> {
  const parsed = parseBirthCustomId(interaction.customId);
  if (!parsed) {
    return false;
  }

  if (interaction.user.id !== parsed.userId) {
    await interaction.reply({
      content: "Это меню предназначено для другого пользователя.",
      ephemeral: true,
    });
    return true;
  }

  const selectedValue = interaction.values[0] ?? NO_VALUE;

  let newMonth = parsed.month;
  let newDay = parsed.day;

  if (parsed.action === MONTH_SELECT_ACTION) {
    newMonth = selectedValue;
    const maxDays = DAYS_PER_MONTH[parseInt(newMonth, 10)] ?? 31;
    if (parseInt(newDay, 10) > maxDays) {
      newDay = NO_VALUE;
    }
  } else if (parsed.action === DAY_SELECT_ACTION) {
    newDay = selectedValue;
  } else {
    return false;
  }

  await interaction.update({
    content: buildBirthCheckMessageContent(),
    components: buildBirthCheckMessageComponents(parsed.guildId, parsed.userId, newMonth, newDay),
  });

  return true;
}

async function handleButtonInteraction(
  interaction: ButtonInteraction,
): Promise<boolean> {
  const parsed = parseBirthCustomId(interaction.customId);
  if (!parsed || parsed.action !== CONFIRM_ACTION) {
    return false;
  }

  if (interaction.user.id !== parsed.userId) {
    await interaction.reply({
      content: "Эта кнопка предназначена для другого пользователя.",
      ephemeral: true,
    });
    return true;
  }

  const { guildId, userId, month, day } = parsed;

  if (month === NO_VALUE || day === NO_VALUE) {
    await interaction.reply({
      content: "Пожалуйста, выбери месяц и день перед подтверждением.",
      ephemeral: true,
    });
    return true;
  }

  const dd = String(parseInt(day, 10)).padStart(2, "0");
  const mm = String(parseInt(month, 10)).padStart(2, "0");
  const dateInput = `${dd}.${mm}`;

  try {
    await birthController.setBirthday(userId, dateInput);
    await birthController.removeFromCheckQueue(guildId, userId);

    const label = dateUtils.formatDayMonth(
      dateUtils.parseDayMonth(dateInput),
    );

    await interaction.update({
      content: `✅ **Дата рождения сохранена:** ${label}\n\nСпасибо! Теперь тебя будут поздравлять на сервере 🎉`,
      components: [],
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
  handleSelectInteraction,
  handleButtonInteraction,
};

export default birthCheck;
