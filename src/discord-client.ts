import { Client, GatewayIntentBits } from "discord.js";

class DiscordClient {
  public readonly client: Client;
  public readonly intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ] as const;

  constructor() {
    this.client = new Client({
      intents: [...this.intents],
    });
  }
}

const discordClient = new DiscordClient();

export default discordClient;
