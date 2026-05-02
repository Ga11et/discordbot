import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import JobExecutor from "../src/jobs/JobExecutor";
import JobManager from "../src/jobs/JobManager";
import testDb from "./helpers/test-db";

describe("JobManager + JobExecutor", () => {
  beforeAll(async () => {
    await testDb.init();
  });

  beforeEach(async () => {
    await testDb.resetJobQ();
  });

  afterAll(async () => {
    await testDb.close();
  });

  it("deletes a successful job from the database", async () => {
    const manager = new JobManager(testDb.client(), 60_000);
    const executed = vi.fn().mockResolvedValue(undefined);
    const runner = new JobExecutor(manager, {
      "test.job": executed,
    });

    await manager.enqueue("test.job", { value: 1 });
    await expect(runner.runNext()).resolves.toBe(true);
    expect(executed).toHaveBeenCalledTimes(1);
    await expect(manager.list()).resolves.toEqual([]);
  });

  it("keeps a failed job queued with incremented attempts and a later run_after", async () => {
    const manager = new JobManager(testDb.client(), 60_000);
    const executed = vi.fn().mockRejectedValue(new Error("boom"));
    const runner = new JobExecutor(manager, {
      "test.job": executed,
    });

    const job = await manager.enqueue("test.job", { value: 2 });

    await expect(runner.runNext()).resolves.toBe(true);

    const queuedJobs = await manager.list();
    expect(queuedJobs).toHaveLength(1);
    expect(queuedJobs[0].id).toBe(job.id);
    expect(queuedJobs[0].attempts).toBe(1);
    expect(queuedJobs[0].lastError).toBe("boom");
    expect(queuedJobs[0].runAfter.getTime()).toBeGreaterThan(
      job.runAfter.getTime(),
    );
  });

  it("runs only one job per tick", async () => {
    const manager = new JobManager(testDb.client(), 60_000);
    const executed = vi.fn().mockResolvedValue(undefined);
    const runner = new JobExecutor(manager, {
      "test.job": executed,
    });

    await manager.enqueue("test.job", { value: 1 });
    await manager.enqueue("test.job", { value: 2 });

    await expect(runner.runNext()).resolves.toBe(true);

    expect(executed).toHaveBeenCalledTimes(1);
    const queuedJobs = await manager.list();
    expect(queuedJobs).toHaveLength(1);
    expect(queuedJobs[0].payload).toEqual({ value: 2 });
  });

  it("does not execute the same job twice during overlapping runNext calls", async () => {
    const manager = new JobManager(testDb.client(), 60_000);

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

    const runner = new JobExecutor(manager, {
      "test.job": executor,
    });

    await manager.enqueue("test.job", { value: 3 });

    const firstRun = runner.runNext();
    const secondRun = runner.runNext();

    await expect(secondRun).resolves.toBe(false);
    await executionStarted;
    expect(executor).toHaveBeenCalledTimes(1);

    resolveExecution();
    await expect(firstRun).resolves.toBe(true);
    await expect(manager.list()).resolves.toEqual([]);
  });

  it("keeps queued jobs available across service re-instantiation", async () => {
    const firstManager = new JobManager(testDb.client(), 60_000);
    await firstManager.enqueue("test.job", { value: 4 });

    const secondManager = new JobManager(testDb.client(), 60_000);
    const executed = vi.fn().mockResolvedValue(undefined);
    const runner = new JobExecutor(secondManager, {
      "test.job": executed,
    });

    await expect(runner.runNext()).resolves.toBe(true);
    expect(executed).toHaveBeenCalledTimes(1);
    await expect(secondManager.list()).resolves.toEqual([]);
  });

  it("does not allow two queue instances to claim the same due job", async () => {
    const firstManager = new JobManager(testDb.client(), 60_000);
    const secondManager = new JobManager(testDb.client(), 60_000);
    await firstManager.enqueue("test.job", { value: 5 });

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

    const firstRunner = new JobExecutor(firstManager, {
      "test.job": firstExecutor,
    });
    const secondRunner = new JobExecutor(secondManager, {
      "test.job": secondExecutor,
    });

    const firstRun = firstRunner.runNext();
    await executionStarted;

    const secondRun = secondRunner.runNext();
    await expect(secondRun).resolves.toBe(false);
    expect(secondExecutor).not.toHaveBeenCalled();

    resolveExecution();
    await expect(firstRun).resolves.toBe(true);
    await expect(firstManager.list()).resolves.toEqual([]);
  });
});
