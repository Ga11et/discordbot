import type { Knex } from "knex";

const TABLE_NAME = "job_queue";
const DEFAULT_RETRY_INTERVAL_MS = 600_000;
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

interface JobRecord {
  id: string;
  type: string;
  payload: unknown;
  attempts: number;
  lastError: string | null;
  runAfter: Date;
  createdAt: Date;
  updatedAt: Date;
}

export default class JobManager {
  constructor(
    private readonly client: Knex,
    private readonly retryIntervalMs: number = DEFAULT_RETRY_INTERVAL_MS,
  ) {}

  public async enqueue(type: string, payload: unknown): Promise<JobRecord> {
    const [row] = await this.client<JobQueueRow>(TABLE_NAME)
      .insert({
        type,
        payload,
      })
      .returning([...RETURNING_COLUMNS]);

    return this.toJobRecord(row);
  }

  public async list(limit: number = 100): Promise<JobRecord[]> {
    const rows = await this.client<JobQueueRow>(TABLE_NAME)
      .select(...RETURNING_COLUMNS)
      .orderBy("run_after", "asc")
      .orderBy("created_at", "asc")
      .orderBy("id", "asc")
      .limit(limit);

    return rows.map((row) => this.toJobRecord(row));
  }

  public async claimNextJob(): Promise<JobRecord | null> {
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
          run_after: this.nextRunAfterExpression(trx),
          updated_at: trx.fn.now(),
        })
        .returning([...RETURNING_COLUMNS]);

      return row ? this.toJobRecord(row) : null;
    });
  }

  public async complete(jobId: string): Promise<void> {
    await this.client(TABLE_NAME).where({ id: jobId }).del();
  }

  public async fail(jobId: string, errorMessage: string): Promise<void> {
    await this.client<JobQueueRow>(TABLE_NAME)
      .where({ id: jobId })
      .update({
        attempts: this.client.raw("attempts + 1"),
        last_error: errorMessage,
        run_after: this.nextRunAfterExpression(this.client),
        updated_at: this.client.fn.now(),
      });
  }

  private toJobRecord(row: JobQueueRow): JobRecord {
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

  private nextRunAfterExpression(client: Knex): Knex.Raw {
    return client.raw(`NOW() + (? || ' milliseconds')::interval`, [
      String(this.retryIntervalMs),
    ]);
  }
}
