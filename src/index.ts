import "dotenv/config";
import { Client, Events, GatewayIntentBits, type Message } from "discord.js";
import { ensureDatabaseConnection, runMigrations } from "./db";
import commandRegister from "./commands/register";
import birthdayHandler from "./commands/birthday-handler";
import kickQueueHandler from "./commands/kick-queue-handler";
import kickQueueCheck from "./commands/kick-queue-check";
import birthdayAccess from "./commands/birthday-access";
import kickQueueAccess from "./commands/kick-queue-access";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  throw new Error(
    "DISCORD_TOKEN is not set. Add it to your environment or .env file.",
  );
}

const birthdayAccessConfig = birthdayAccess.loadConfig();
const kickQueueAccessConfig = kickQueueAccess.loadConfig();

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
      const hasAccess = await birthdayAccess.ensureAccess(
        interaction,
        birthdayAccessConfig,
      );
      if (!hasAccess) {
        return;
      }
    }

    const handled = await birthdayHandler.handleModalSubmit(interaction);
    if (handled) {
      return;
    }
  }

  if (interaction.isButton()) {
    const handled = await kickQueueCheck.handleButtonInteraction(interaction);
    if (handled) {
      return;
    }
  }

  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === "kickqueue") {
    const hasAccess = await kickQueueAccess.ensureAccess(
      interaction,
      kickQueueAccessConfig,
    );
    if (!hasAccess) {
      return;
    }

    await kickQueueHandler.handleCommand(interaction);
    return;
  }

  if (interaction.commandName === "bd") {
    const hasAccess = await birthdayAccess.ensureAccess(
      interaction,
      birthdayAccessConfig,
      {
        requireRole: !birthdayAccess.isPublicSubcommand(interaction),
      },
    );
    if (!hasAccess) {
      return;
    }

    await birthdayHandler.handleCommand(interaction);
    return;
  }

  return;
});

async function bootstrap(): Promise<void> {
  await ensureDatabaseConnection();
  await runMigrations();
  await commandRegister.register();
  await client.login(token);
}

void bootstrap().catch((error) => {
  console.error("Не удалось запустить бота", error);
  process.exit(1);
});
