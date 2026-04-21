import "dotenv/config";
import { Client, Events, GatewayIntentBits, type Message } from "discord.js";
import { ensureDatabaseConnection, runMigrations } from "./db";
import { registerSlashCommands } from "./commands/register";
import {
  handleBirthdayCommand,
  handleBirthdayModalSubmit,
} from "./commands/birthday-handler";
import { handleKickQueueCommand } from "./commands/kick-queue-handler";
import { handleKickQueueButtonInteraction } from "./commands/kick-queue-check";
import {
  ensureBirthdayAccess,
  isPublicBirthdaySubcommand,
  loadBirthdayAccessConfig,
} from "./commands/birthday-access";
import {
  ensureKickQueueAccess,
  loadKickQueueAccessConfig,
} from "./commands/kick-queue-access";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  throw new Error(
    "DISCORD_TOKEN is not set. Add it to your environment or .env file.",
  );
}

const birthdayAccessConfig = loadBirthdayAccessConfig();
const kickQueueAccessConfig = loadKickQueueAccessConfig();

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
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith("bd:")) {
      const hasAccess = await ensureBirthdayAccess(
        interaction,
        birthdayAccessConfig,
      );
      if (!hasAccess) {
        return;
      }
    }

    const handled = await handleBirthdayModalSubmit(interaction);
    if (handled) {
      return;
    }
  }

  if (interaction.isButton()) {
    const handled = await handleKickQueueButtonInteraction(interaction);
    if (handled) {
      return;
    }
  }

  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === "kickqueue") {
    const hasAccess = await ensureKickQueueAccess(
      interaction,
      kickQueueAccessConfig,
    );
    if (!hasAccess) {
      return;
    }

    await handleKickQueueCommand(interaction);
    return;
  }

  if (interaction.commandName === "bd") {
    const hasAccess = await ensureBirthdayAccess(
      interaction,
      birthdayAccessConfig,
      {
        requireRole: !isPublicBirthdaySubcommand(interaction),
      },
    );
    if (!hasAccess) {
      return;
    }

    await handleBirthdayCommand(interaction);
    return;
  }

  return;
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
