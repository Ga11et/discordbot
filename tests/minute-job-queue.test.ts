import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createMinuteJobQueue } from "../src/jobs/minute-job-queue";
import {
  closeTestDb,
  getTestClient,
  resetJobQueueTable,
  setupTestDb,
} from "./helpers/test-db";

describe("MinuteJobQueue", () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await resetJobQueueTable();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("deletes a successful job from the database", async () => {
    const queue = createMinuteJobQueue(getTestClient(), 60_000);
    await queue.enqueue("test.job", { value: 1 });

    const executed = vi.fn().mockResolvedValue(undefined);

    await expect(queue.runNext(executed)).resolves.toBe(true);
    expect(executed).toHaveBeenCalledTimes(1);
    await expect(queue.list()).resolves.toEqual([]);
  });

  it("keeps a failed job queued with incremented attempts and a later run_after", async () => {
    const queue = createMinuteJobQueue(getTestClient(), 60_000);
    const job = await queue.enqueue("test.job", { value: 2 });

    const executed = vi.fn().mockRejectedValue(new Error("boom"));

    await expect(queue.runNext(executed)).resolves.toBe(true);

    const queuedJobs = await queue.list();
    expect(queuedJobs).toHaveLength(1);
    expect(queuedJobs[0].id).toBe(job.id);
    expect(queuedJobs[0].attempts).toBe(1);
    expect(queuedJobs[0].lastError).toBe("boom");
    expect(queuedJobs[0].runAfter.getTime()).toBeGreaterThan(
      job.runAfter.getTime(),
    );
  });

  it("runs only one job per tick", async () => {
    const queue = createMinuteJobQueue(getTestClient(), 60_000);
    await queue.enqueue("test.job", { value: 1 });
    await queue.enqueue("test.job", { value: 2 });

    const executed = vi.fn().mockResolvedValue(undefined);

    await expect(queue.runNext(executed)).resolves.toBe(true);

    expect(executed).toHaveBeenCalledTimes(1);
    const queuedJobs = await queue.list();
    expect(queuedJobs).toHaveLength(1);
    expect(queuedJobs[0].payload).toEqual({ value: 2 });
  });

  it("does not execute the same job twice during overlapping runNext calls", async () => {
    const queue = createMinuteJobQueue(getTestClient(), 60_000);
    await queue.enqueue("test.job", { value: 3 });

    let notifyExecutionStarted: (() => void) | null = null;
    const executionStarted = new Promise<void>((resolve) => {
      notifyExecutionStarted = resolve;
    });
    let resolveExecution!: () => void;
    const executor = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          notifyExecutionStarted?.();
          resolveExecution = resolve;
        }),
    );

    const firstRun = queue.runNext(executor);
    const secondRun = queue.runNext(executor);

    await expect(secondRun).resolves.toBe(false);
    await executionStarted;
    expect(executor).toHaveBeenCalledTimes(1);

    resolveExecution();
    await expect(firstRun).resolves.toBe(true);
    await expect(queue.list()).resolves.toEqual([]);
  });

  it("keeps queued jobs available across service re-instantiation", async () => {
    const firstQueue = createMinuteJobQueue(getTestClient(), 60_000);
    await firstQueue.enqueue("test.job", { value: 4 });

    const secondQueue = createMinuteJobQueue(getTestClient(), 60_000);
    const executed = vi.fn().mockResolvedValue(undefined);

    await expect(secondQueue.runNext(executed)).resolves.toBe(true);
    expect(executed).toHaveBeenCalledTimes(1);
    await expect(secondQueue.list()).resolves.toEqual([]);
  });

  it("does not allow two queue instances to claim the same due job", async () => {
    const firstQueue = createMinuteJobQueue(getTestClient(), 60_000);
    const secondQueue = createMinuteJobQueue(getTestClient(), 60_000);
    await firstQueue.enqueue("test.job", { value: 5 });

    let notifyExecutionStarted: (() => void) | null = null;
    const executionStarted = new Promise<void>((resolve) => {
      notifyExecutionStarted = resolve;
    });
    let resolveExecution!: () => void;
    const firstExecutor = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          notifyExecutionStarted?.();
          resolveExecution = resolve;
        }),
    );
    const secondExecutor = vi.fn().mockResolvedValue(undefined);

    const firstRun = firstQueue.runNext(firstExecutor);
    await executionStarted;

    const secondRun = secondQueue.runNext(secondExecutor);
    await expect(secondRun).resolves.toBe(false);
    expect(secondExecutor).not.toHaveBeenCalled();

    resolveExecution();
    await expect(firstRun).resolves.toBe(true);
    await expect(firstQueue.list()).resolves.toEqual([]);
  });
});
