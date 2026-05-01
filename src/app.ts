import { Events } from "discord.js";
import commandRegister from "./commands/register";
import discordClient from "./discord-client";
import Interaction from "./events/interaction-create";
import { handleClientReady } from "./events/ready";
import { minuteJobQueue } from "./jobs/minute-job-queue";
import { createKickQueueJobExecutor } from "./jobs/kick-queue-job-executor";

export interface App {
  stop: () => Promise<void>;
}

export async function createApp(): Promise<App> {
  const client = discordClient.client;

  const interaction = new Interaction();

  client.once(Events.ClientReady, handleClientReady);
  client.on(Events.InteractionCreate, interaction.handleInteraction);

  const config = loadConfig();
  await commandRegister.register(config);

  const jobs = createKickQueueJobExecutor(client);
  minuteJobQueue.start(jobs);

  await client.login(config.token);

  return {
    async stop(): Promise<void> {
      minuteJobQueue.stop();
      client.removeAllListeners();
      discordClient.destroy();
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
