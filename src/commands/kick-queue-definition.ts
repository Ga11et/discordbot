import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";

const kickQueueBuilder = new SlashCommandBuilder()
  .setName("kickqueue")
  .setDescription("Управление очередью пользователей на кик")
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Добавить пользователя в очередь на кик")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("Пользователь для добавления в очередь")
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Удалить пользователя из очереди на кик")
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("Пользователь для удаления из очереди")
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("list")
      .setDescription(
        "Показать очередь пользователей на кик для этого сервера",
      ),
  );

export const kickQueueCommandDefinition =
  kickQueueBuilder.toJSON() satisfies RESTPostAPIChatInputApplicationCommandsJSONBody;
