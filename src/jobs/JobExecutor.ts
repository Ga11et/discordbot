import JobManager from "./JobManager";

const DEFAULT_POLL_INTERVAL_MS = 60_000;

interface RunnableJob {
  id: string;
  type: string;
  payload: unknown;
}

type JobHandler = (job: RunnableJob) => Promise<void>;
type JobHandlerMap = Record<string, JobHandler>;

export default class JobExecutor {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly manager: JobManager,
    private readonly handlers: JobHandlerMap,
    private readonly pollMs: number = DEFAULT_POLL_INTERVAL_MS,
  ) {}

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
        return true;
      }

      try {
        await handler(job);
        await this.manager.complete(job.id);
      } catch (error) {
        await this.manager.fail(job.id, this.toErrorMessage(error));
      }

      return true;
    } finally {
      this.isRunning = false;
    }
  }

  public start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.runNext();
    }, this.pollMs);
  }

  public stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
