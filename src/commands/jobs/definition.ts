import {
  SlashCommandBuilder,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";

const jobsBuilder = new SlashCommandBuilder()
  .setName("jobs")
  .setDescription("Управление фоновыми задачами")
  .addSubcommand((sub) =>
    sub
      .setName("list")
      .setDescription("Показать таблицу активных задач в очереди"),
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Удалить задачу из очереди по ID")
      .addStringOption((option) =>
        option
          .setName("id")
          .setDescription("ID задачи")
          .setRequired(true),
      ),
  );

export default jobsBuilder.toJSON() satisfies RESTPostAPIChatInputApplicationCommandsJSONBody;
