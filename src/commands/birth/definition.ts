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
  )
  .addSubcommand((sub) =>
    sub
      .setName("check")
      .setDescription("Отправить пользователю DM с запросом даты рождения")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("Пользователь, которому отправить запрос")
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("checkall")
      .setDescription(
        "Отправить DM с запросом даты рождения всем участникам без неё",
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("queue")
      .setDescription("Показать очередь на отправку запроса даты рождения"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("dequeue")
      .setDescription("Удалить пользователя из очереди на запрос даты рождения")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("Пользователь, которого убрать из очереди")
          .setRequired(true),
      ),
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
  )
  .addSubcommandGroup((group) =>
    group
      .setName("gratzlog")
      .setDescription("Лог поздравлений с днём рождения")
      .addSubcommand((sub) =>
        sub
          .setName("list")
          .setDescription("Показать последние поздравления")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("Фильтр по пользователю")
              .setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName("delete")
          .setDescription("Удалить последнее поздравление пользователя")
          .addUserOption((option) =>
            option
              .setName("user")
              .setDescription("Пользователь, у которого удалить последнюю запись")
              .setRequired(true),
          ),
      ),
  );

export default birthBuilder.toJSON() satisfies RESTPostAPIChatInputApplicationCommandsJSONBody;
