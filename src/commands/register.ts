import { REST, Routes } from "discord.js";
import { slashCommandDefinitions as birthdayCommandDefinitions } from "./birthday-definition";
import { kickQueueCommandDefinition } from "./kick-queue-definition";

const slashCommandDefinitions = [
  ...birthdayCommandDefinitions,
  kickQueueCommandDefinition,
];

interface CommandRegistrationConfig {
  token: string;
  clientId: string;
}

async function register(config: CommandRegistrationConfig): Promise<void> {
  const { token, clientId } = config;

  const rest = new REST({ version: "10" }).setToken(token);

  await rest.put(Routes.applicationCommands(clientId), {
    body: slashCommandDefinitions,
  });
  console.log("Глобальные slash-команды обновлены");
}

const commandRegister = {
  register,
};

export default commandRegister;
