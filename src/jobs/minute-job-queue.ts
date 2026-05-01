import type { Knex } from "knex";
import db from "../db";

const TABLE_NAME = "job_queue";
const DEFAULT_INTERVAL_MS = 600_000;
const RETURNING_COLUMNS = [
  "id",
  "type",
  "payload",
  "attempts",
  "last_error",
  "run_after",
  "created_at",
  "updated_at",
] as const;

interface JobQueueRow {
  id: string | number;
  type: string;
  payload: unknown;
  attempts: number;
  last_error: string | null;
  run_after: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface JobQueueRecord<TPayload = unknown> {
  id: string;
  type: string;
  payload: TPayload;
  attempts: number;
  lastError: string | null;
  runAfter: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type JobExecutor = (job: JobQueueRecord) => Promise<void>;

function mapRowToRecord(row: JobQueueRow): JobQueueRecord {
  return {
    id: String(row.id),
    type: row.type,
    payload: row.payload,
    attempts: Number(row.attempts),
    lastError: row.last_error,
    runAfter: new Date(row.run_after),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function getNextRunAfterExpression(client: Knex, intervalMs: number): Knex.Raw {
  return client.raw(`NOW() + (? || ' milliseconds')::interval`, [
    String(intervalMs),
  ]);
}

export class MinuteJobQueue {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly client: Knex,
    private readonly intervalMs: number = DEFAULT_INTERVAL_MS,
  ) {}

  async enqueue(type: string, payload: unknown): Promise<JobQueueRecord> {
    const [row] = await this.client<JobQueueRow>(TABLE_NAME)
      .insert({
        type,
        payload,
      })
      .returning([...RETURNING_COLUMNS]);

    return mapRowToRecord(row);
  }

  async list(limit: number = 100): Promise<JobQueueRecord[]> {
    const rows = await this.client<JobQueueRow>(TABLE_NAME)
      .select(...RETURNING_COLUMNS)
      .orderBy("run_after", "asc")
      .orderBy("created_at", "asc")
      .orderBy("id", "asc")
      .limit(limit);

    return rows.map(mapRowToRecord);
  }

  async runNext(executor: JobExecutor): Promise<boolean> {
    if (this.isRunning) {
      return false;
    }

    this.isRunning = true;
    try {
      const job = await this.claimNextDueJob();
      if (!job) {
        return false;
      }

      try {
        await executor(job);
        await this.deleteJob(job.id);
      } catch (error) {
        await this.releaseFailedJob(job.id, errorToMessage(error));
      }

      return true;
    } finally {
      this.isRunning = false;
    }
  }

  start(executor: JobExecutor): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.runNext(executor);
    }, this.intervalMs);
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  private async claimNextDueJob(): Promise<JobQueueRecord | null> {
    return this.client.transaction(async (trx) => {
      const nextJob = await trx<JobQueueRow>(TABLE_NAME)
        .select("id")
        .where("run_after", "<=", trx.fn.now())
        .orderBy("run_after", "asc")
        .orderBy("created_at", "asc")
        .orderBy("id", "asc")
        .forUpdate()
        .skipLocked()
        .first();

      if (!nextJob) {
        return null;
      }

      const [row] = await trx<JobQueueRow>(TABLE_NAME)
        .where({ id: nextJob.id })
        .update({
          run_after: getNextRunAfterExpression(trx, this.intervalMs),
          updated_at: trx.fn.now(),
        })
        .returning([...RETURNING_COLUMNS]);

      return row ? mapRowToRecord(row) : null;
    });
  }

  private async deleteJob(jobId: string): Promise<void> {
    await this.client(TABLE_NAME).where({ id: jobId }).del();
  }

  private async releaseFailedJob(
    jobId: string,
    message: string,
  ): Promise<void> {
    await this.client<JobQueueRow>(TABLE_NAME)
      .where({ id: jobId })
      .update({
        attempts: this.client.raw("attempts + 1"),
        last_error: message,
        run_after: getNextRunAfterExpression(this.client, this.intervalMs),
        updated_at: this.client.fn.now(),
      });
  }
}

export function createMinuteJobQueue(
  customClient: Knex = db.client,
  intervalMs: number = DEFAULT_INTERVAL_MS,
): MinuteJobQueue {
  return new MinuteJobQueue(customClient, intervalMs);
}

export const minuteJobQueue = createMinuteJobQueue();
