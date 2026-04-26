import { Client, GatewayIntentBits } from "discord.js";

export const CLIENT_INTENTS = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
] as const;

export function createDiscordClient(): Client {
  return new Client({
    intents: [...CLIENT_INTENTS],
  });
}
