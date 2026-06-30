import {
  SlashCommandBuilder,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";

const birthBuilder = new SlashCommandBuilder()
  .setName("birth")
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
          .setDescription("Дата в формате ДД.ММ, например 16.01")
          .setRequired(true),
      )
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription(
            "Указать другого пользователя (если не указать — обновится своя дата)",
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("get")
      .setDescription("Показать дату рождения пользователя")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("Пользователь, чью дату рождения показать")
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("delete")
      .setDescription("Удалить сохранённую дату рождения пользователя")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("У кого удалить дату рождения")
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("list")
      .setDescription("Показать список сохранённых дат рождения"),
  );

export default birthBuilder.toJSON() satisfies RESTPostAPIChatInputApplicationCommandsJSONBody;
