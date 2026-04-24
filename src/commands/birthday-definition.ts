import {
  SlashCommandBuilder,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";

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
          .setDescription(
            "Указать другого пользователя (если не указать — обновится своя дата)",
          ),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("list")
      .setDescription("Показать список сохранённых дат рождения"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("gratz")
      .setDescription("Поздравить пользователя случайным сообщением")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("Кого поздравить")
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName("messageid")
          .setDescription("Идентификатор поздравления")
          .setRequired(false),
      ),
  )
  .addSubcommandGroup((group) =>
    group
      .setName("gratzmessage")
      .setDescription("Управление сообщениями для поздравлений")
      .addSubcommand((sub) =>
        sub
          .setName("create")
          .setDescription("Создать новое поздравительное сообщение"),
      )
      .addSubcommand((sub) =>
        sub
          .setName("get")
          .setDescription("Показать поздравительное сообщение по id")
          .addStringOption((option) =>
            option
              .setName("messageid")
              .setDescription("Идентификатор сообщения")
              .setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("delete")
          .setDescription("Удалить поздравительное сообщение по id")
          .addStringOption((option) =>
            option
              .setName("messageid")
              .setDescription("Идентификатор сообщения")
              .setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName("list").setDescription("Список поздравительных сообщений"),
      ),
  );

export const birthdayCommandDefinition =
  birthdayBuilder.toJSON() satisfies RESTPostAPIChatInputApplicationCommandsJSONBody;

export const slashCommandDefinitions: RESTPostAPIChatInputApplicationCommandsJSONBody[] =
  [birthdayCommandDefinition];
