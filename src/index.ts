import "dotenv/config";
import { Client, Events, GatewayIntentBits, type Message } from "discord.js";
import { ensureDatabaseConnection, runMigrations } from "./db";
import { registerSlashCommands } from "./commands/register";
import { handleBirthdayCommand } from "./commands/birthday-handler";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  throw new Error(
    "DISCORD_TOKEN is not set. Add it to your environment or .env file.",
  );
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Бот запущен как ${readyClient.user.tag}`);
});

client.on(Events.MessageCreate, (message: Message) => {
  if (message.author.bot) return;

  if (message.content === "!ping") {
    void message.reply("Pong!");
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "bd") return;

  await handleBirthdayCommand(interaction);
});

async function bootstrap(): Promise<void> {
  await ensureDatabaseConnection();
  await runMigrations();
  await registerSlashCommands();
  await client.login(token);
}

void bootstrap().catch((error) => {
  console.error("Не удалось запустить бота", error);
  process.exit(1);
});
