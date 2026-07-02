import {
  MessageFlags,
  type ChatInputCommandInteraction,
  type InteractionReplyOptions,
} from "discord.js";
import Database from "../../db";
import JMProvider from "../../jobs/JobManagerProvider";
import { BIRTH_SEND_CHECK_MESSAGE_JOB } from "../../jobs/handlers/birth";
import { KICK_QUEUE_SEND_CHECK_MESSAGE_JOB } from "../../jobs/handlers/kickqueue";
import { BirthCheckQueueDb } from "../../modules/birth/check-queue-db";
import KickQueueService from "../../modules/members/services/kick-queue-service";

const EPHEMERAL_FLAGS = MessageFlags.Ephemeral;

interface JobRecord {
  id: string;
  type: string;
  payload: unknown;
  attempts: number;
  lastError: string | null;
  runAfter: Date;
  createdAt: Date;
}

function formatDate(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

function buildJobTable(jobs: JobRecord[]): string {
  if (jobs.length === 0) {
    return "Очередь задач пуста.";
  }

  const header = "```\n" +
    "ID  | Тип                          | Попытки | Запуск после        | Создана             | Ошибка\n" +
    "----|------------------------------|---------|---------------------|---------------------|--------------------\n";

  const rows = jobs.map((job) => {
    const id = job.id.padEnd(3);
    const type = truncate(job.type, 28).padEnd(28);
    const attempts = String(job.attempts).padStart(7);
    const runAfter = formatDate(job.runAfter);
    const createdAt = formatDate(job.createdAt);
    const lastError = job.lastError ? truncate(job.lastError, 20) : "—";
    return `${id} | ${type} | ${attempts} | ${runAfter} | ${createdAt} | ${lastError}`;
  });

  return header + rows.join("\n") + "\n```";
}

async function respond(
  interaction: ChatInputCommandInteraction,
  content: string,
  options?: Omit<InteractionReplyOptions, "content">,
): Promise<void> {
  const payload: InteractionReplyOptions = { content, ...options };

  if (interaction.deferred || interaction.replied) {
    await interaction.followUp(payload);
  } else {
    await interaction.reply(payload);
  }
}

interface GuildUserPayload {
  guildId: string | number;
  userId: string | number;
}

function isGuildUserPayload(payload: unknown): payload is GuildUserPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "guildId" in payload &&
    "userId" in payload
  );
}

async function cleanupRelatedStatus(job: JobRecord): Promise<void> {
  if (!isGuildUserPayload(job.payload)) {
    return;
  }

  const guildId = String(job.payload.guildId);
  const userId = String(job.payload.userId);

  if (job.type === BIRTH_SEND_CHECK_MESSAGE_JOB) {
    const birthCheckQueueDb = new BirthCheckQueueDb(Database.client);
    await birthCheckQueueDb.removePending(guildId, userId);
    return;
  }

  if (job.type === KICK_QUEUE_SEND_CHECK_MESSAGE_JOB) {
    const kickQueueService = new KickQueueService(Database.client);
    await kickQueueService.removePendingKickUser(guildId, userId);
  }
}

async function handleCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "list") {
    await interaction.deferReply({ flags: EPHEMERAL_FLAGS });

    try {
      const jobManager = JMProvider.get();
      const jobs = await jobManager.list();
      const table = buildJobTable(jobs);
      await interaction.editReply(table);
    } catch (error) {
      console.error("Ошибка при обработке /jobs list", error);
      await interaction.editReply("Произошла ошибка при получении списка задач.");
    }
    return;
  }

  if (subcommand === "remove") {
    const jobId = interaction.options.getString("id", true);

    try {
      const jobManager = JMProvider.get();
      const job = await jobManager.findById(jobId);
      if (!job) {
        await respond(interaction, `Задача #${jobId} не найдена.`, { flags: EPHEMERAL_FLAGS });
        return;
      }

      await cleanupRelatedStatus(job);
      await jobManager.remove(jobId);

      await respond(interaction, `Задача #${jobId} удалена из очереди.`, { flags: EPHEMERAL_FLAGS });
    } catch (error) {
      console.error("Ошибка при обработке /jobs remove", error);
      await respond(interaction, "Произошла ошибка при удалении задачи.", {
        flags: EPHEMERAL_FLAGS,
      });
    }
    return;
  }

  await respond(interaction, "Неизвестная подкоманда.", { flags: EPHEMERAL_FLAGS });
}

const jobsHandler = { handleCommand };

export default jobsHandler;
