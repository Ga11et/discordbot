import { REST, Routes } from "discord.js";
import { slashCommandDefinitions as birthdayCommandDefinitions } from "./birthday-definition";
import { kickQueueCommandDefinition } from "./kick-queue-definition";

const slashCommandDefinitions = [
  ...birthdayCommandDefinitions,
  kickQueueCommandDefinition,
];

export async function registerSlashCommands(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!token) {
    throw new Error("DISCORD_TOKEN is not set");
  }
  if (!clientId) {
    throw new Error("DISCORD_CLIENT_ID is not set");
  }

  const rest = new REST({ version: "10" }).setToken(token);

  await rest.put(Routes.applicationCommands(clientId), {
    body: slashCommandDefinitions,
  });
  console.log("Глобальные slash-команды обновлены");
}
