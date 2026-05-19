import { Events } from "discord.js";
import Registrator from "./commands/Registrator";
import Database from "./db";
import DiscordClient from "./discord-client";
import Interaction from "./events/interaction-create";
import { handleClientReady } from "./events/ready";
import JobExecutor from "./jobs/JobExecutor";

export interface App {
  stop: () => Promise<void>;
}

export async function createApp(): Promise<App> {
  // Core dependencies
  const discord = DiscordClient.client;
  const db = Database.client;
  const config = loadConfig();

  // Interaction routing
  const interaction = new Interaction();
  discord.once(Events.ClientReady, handleClientReady);
  discord.on(Events.InteractionCreate, interaction.handleInteraction);

  // Command registration
  await Registrator.register(config);
  await discord.login(config.token);

  // Background jobs lifecycle
  const jobExecutor = new JobExecutor(db, discord);
  jobExecutor.start();

  return {
    async stop(): Promise<void> {
      // Background jobs shutdown
      jobExecutor.stop();

      // Discord client shutdown
      discord.removeAllListeners();
      discord.destroy();
    },
  };
}

function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    token: loadEnv("DISCORD_TOKEN", env),
    clientId: loadEnv("DISCORD_CLIENT_ID", env),
  };
}

function loadEnv(name: string, env: NodeJS.ProcessEnv): string {
  const value = env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Add it to your environment or .env file.`,
    );
  }

  return value;
}
