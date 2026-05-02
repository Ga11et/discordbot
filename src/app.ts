import { Events } from "discord.js";
import Registrator from "./commands/Registrator";
import Database from "./db";
import DiscordClient from "./discord-client";
import Interaction from "./events/interaction-create";
import { handleClientReady } from "./events/ready";
import JobExecutor from "./jobs/JobExecutor";
import JobHandlers from "./jobs/JobHandlers";
import JMProvider from "./jobs/JobManagerProvider";

export interface App {
  stop: () => Promise<void>;
}

export async function createApp(): Promise<App> {
  const discord = DiscordClient.client;
  const db = Database.client;

  const interaction = new Interaction();

  discord.once(Events.ClientReady, handleClientReady);
  discord.on(Events.InteractionCreate, interaction.handleInteraction);

  const config = loadConfig();

  await Registrator.register(config);

  const manager = JMProvider.init(db);
  const handlers = new JobHandlers(discord).handlers();
  const jobExecutor = new JobExecutor(manager, handlers);
  jobExecutor.start();

  await discord.login(config.token);

  return {
    async stop(): Promise<void> {
      jobExecutor.stop();
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
