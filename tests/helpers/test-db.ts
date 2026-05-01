import { config as loadEnv } from "dotenv";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import knex, { type Knex } from "knex";

const requiredTestDbEnv = [
  "POSTGRES_TEST_HOST",
  "POSTGRES_TEST_PORT",
  "POSTGRES_TEST_DB",
  "POSTGRES_TEST_USER",
  "POSTGRES_TEST_PASSWORD",
] as const;

class TestDbHelper {
  private db: Knex | null = null;
  private hasMigrated = false;
  private initPromise: Promise<void> | null = null;
  private isEnvInitialized = false;

  public async init(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = (async () => {
      this.env();

      if (!this.db) {
        this.db = this.makeClient();
      }

      await this.mig(this.db);
    })();

    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  public client(): Knex {
    if (!this.db) {
      throw new Error(
        "Test DB is not initialized. Call testDb.init() in beforeAll.",
      );
    }

    return this.db;
  }

  public async resetBd(): Promise<void> {
    await this.client()("birthdays").truncate();
  }

  public async resetGratz(): Promise<void> {
    await this.client()("birthday_gratz_messages").truncate();
  }

  public async resetKickQ(): Promise<void> {
    await this.client()("kick_queue").truncate();
  }

  public async resetJobQ(): Promise<void> {
    await this.client()("job_queue").truncate();
  }

  public async close(): Promise<void> {
    if (!this.db) {
      return;
    }

    await this.db.destroy();
    this.db = null;
    this.hasMigrated = false;
  }

  private env(): void {
    if (this.isEnvInitialized) {
      return;
    }

    loadEnv({ path: ".env.test" });

    for (const key of requiredTestDbEnv) {
      if (!process.env[key]) {
        throw new Error(`Missing required test DB env var: ${key}`);
      }
    }

    this.isEnvInitialized = true;
  }

  private makeClient(): Knex {
    const {
      POSTGRES_TEST_HOST,
      POSTGRES_TEST_PORT,
      POSTGRES_TEST_DB,
      POSTGRES_TEST_USER,
      POSTGRES_TEST_PASSWORD,
    } = process.env;

    return knex({
      client: "pg",
      connection: {
        host: POSTGRES_TEST_HOST,
        port: Number(POSTGRES_TEST_PORT),
        database: POSTGRES_TEST_DB,
        user: POSTGRES_TEST_USER,
        password: POSTGRES_TEST_PASSWORD,
      },
      pool: {
        min: 0,
        max: 10,
      },
    });
  }

  private migSql(): string[] {
    const migrationsDir = join(process.cwd(), "migrations");
    return readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort()
      .map((file) => readFileSync(join(migrationsDir, file), "utf-8"));
  }

  private async mig(targetClient: Knex): Promise<void> {
    if (this.hasMigrated) {
      return;
    }

    const migrations = this.migSql();
    for (const sql of migrations) {
      await targetClient.raw(sql);
    }

    this.hasMigrated = true;
  }
}

const testDb = new TestDbHelper();

export default testDb;
