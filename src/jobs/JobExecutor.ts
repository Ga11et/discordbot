import { Knex } from "knex";
import { Client } from "discord.js";
import JMProvider from "./JobManagerProvider";
import JobHandlers from "./JobHandlers";
import JobManager from "./JobManager";

const DEFAULT_POLL_INTERVAL_MS = 30_000;
const MIN_POLL_INTERVAL_MS = 30_000;
const MAX_POLL_INTERVAL_MS = 7_200_000;

interface RunnableJob {
  id: string;
  type: string;
  payload: unknown;
}

type JobHandler = (job: RunnableJob) => Promise<void>;
type JobHandlerMap = Record<string, JobHandler>;

interface JobExecutorDeps {
  manager?: JobManager;
  handlers?: JobHandlerMap;
}

export default class JobExecutor {
  private timer: NodeJS.Timeout | null = null;
  private isStarted = false;
  private isRunning = false;
  private currentPollMs: number;

  private manager: JobManager;
  private handlers: JobHandlerMap;

  constructor(
    private readonly db: Knex,
    private readonly discord: Client,
    private readonly pollMs: number = DEFAULT_POLL_INTERVAL_MS,
    deps?: JobExecutorDeps,
  ) {
    this.currentPollMs = this.clampPollMs(this.pollMs);
    this.manager = deps?.manager ?? JMProvider.init(this.db);
    this.handlers = deps?.handlers ?? new JobHandlers(this.discord).handlers();
  }

  public async runNext(): Promise<boolean> {
    if (this.isRunning) {
      return false;
    }

    this.isRunning = true;
    try {
      const job = await this.manager.claimNextJob();
      if (!job) {
        return false;
      }

      const handler = this.handlers[job.type];
      if (!handler) {
        await this.manager.fail(job.id, `Unknown job type: ${job.type}`);
        this.increasePollInterval("failure");
        return true;
      }

      try {
        await handler(job);
        await this.manager.complete(job.id);
        this.decreasePollInterval("success");
      } catch (error) {
        await this.manager.fail(job.id, this.toErrorMessage(error));
        this.increasePollInterval("failure");
      }

      return true;
    } finally {
      this.isRunning = false;
    }
  }

  public start(): void {
    if (this.isStarted) {
      return;
    }

    this.isStarted = true;
    this.scheduleNextTick();

    console.log(
      `Job scheduler started (poll interval: ${this.currentPollMs}ms)`,
    );
  }

  public stop(): void {
    this.isStarted = false;
    if (!this.timer) {
      return;
    }

    clearTimeout(this.timer);
    this.timer = null;
  }

  private scheduleNextTick(): void {
    if (!this.isStarted || this.timer) {
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.runCycle();
    }, this.currentPollMs);
  }

  private async runCycle(): Promise<void> {
    await this.runNext();

    if (!this.isStarted) {
      return;
    }

    this.scheduleNextTick();
  }

  private increasePollInterval(reason: "failure"): void {
    const nextPollMs = this.clampPollMs(this.currentPollMs * 2);
    this.updatePollInterval(nextPollMs, reason);
  }

  private decreasePollInterval(reason: "success"): void {
    const nextPollMs = this.clampPollMs(Math.floor(this.currentPollMs / 2));
    this.updatePollInterval(nextPollMs, reason);
  }

  private updatePollInterval(
    nextPollMs: number,
    reason: "failure" | "success",
  ): void {
    if (nextPollMs === this.currentPollMs) {
      return;
    }

    const previousPollMs = this.currentPollMs;
    this.currentPollMs = nextPollMs;
    console.log(
      `Job scheduler interval updated: ${previousPollMs}ms -> ${this.currentPollMs}ms (${reason})`,
    );
  }

  private clampPollMs(pollMs: number): number {
    return Math.min(
      Math.max(pollMs, MIN_POLL_INTERVAL_MS),
      MAX_POLL_INTERVAL_MS,
    );
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
