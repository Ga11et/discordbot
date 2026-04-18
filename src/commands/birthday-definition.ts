import { SlashCommandBuilder, type RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord.js";

const birthdayBuilder = new SlashCommandBuilder()
  .setName("bd")
  .setDescription("Управление днями рождения")
  .addSubcommand((sub) =>
    sub
      .setName("me")
      .setDescription("Показать твою дату рождения, если она сохранена"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("set")
      .setDescription("Установить или обновить дату рождения")
      .addStringOption((option) =>
        option
          .setName("date")
          .setDescription("Дата в формате ДД.ММ.ГГГГ")
          .setRequired(true),
      )
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("Указать другого пользователя (если не указать — обновится своя дата)"),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("list")
      .setDescription("Показать список сохранённых дат рождения"),
  );

export const birthdayCommandDefinition = birthdayBuilder.toJSON() satisfies RESTPostAPIChatInputApplicationCommandsJSONBody;

export const slashCommandDefinitions: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [
  birthdayCommandDefinition,
];
