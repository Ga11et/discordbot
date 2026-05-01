import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { types } from "pg";
import knex, { type Knex } from "knex";

const TIMESTAMPTZ_OID = 1184;
types.setTypeParser(TIMESTAMPTZ_OID, (value) => value);

type ConnectionOverrides = Partial<Knex.PgConnectionConfig>;

class Database {
  public readonly client: Knex;

  constructor() {
    this.client = this.createClient();
  }

  private defaultConnection(): Knex.PgConnectionConfig {
    const {
      POSTGRES_HOST = "localhost",
      POSTGRES_PORT = "5432",
      POSTGRES_DB = "discordbot_db",
      POSTGRES_USER = "discordbot_user",
      POSTGRES_PASSWORD = "discordbot_pass",
    } = process.env;

    return {
      host: POSTGRES_HOST,
      port: Number(POSTGRES_PORT),
      database: POSTGRES_DB,
      user: POSTGRES_USER,
      password: POSTGRES_PASSWORD,
    };
  }

  public createClient(overrides?: ConnectionOverrides): Knex {
    const connection = {
      ...this.defaultConnection(),
      ...overrides,
    };

    return knex({
      client: "pg",
      connection,
      pool: {
        min: 0,
        max: 10,
      },
    });
  }

  /**
   * Performs a lightweight connectivity check to ensure the pool can reach PostgreSQL.
   */
  public async ensureConnection(): Promise<void> {
    await this.client.raw("SELECT 1");
    console.log("Подключение к PostgreSQL установлено");
  }

  private migFiles(): string[] {
    const migrationsDir = join(process.cwd(), "migrations");
    try {
      return readdirSync(migrationsDir)
        .filter((file) => file.endsWith(".sql"))
        .sort()
        .map((file) => readFileSync(join(migrationsDir, file), "utf-8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  public async runMigrations(): Promise<void> {
    const migrations = this.migFiles();
    for (const sql of migrations) {
      await this.client.raw(sql);
    }
  }

  public async closeConnection(): Promise<void> {
    await this.client.destroy();
  }
}

const db = new Database();

export default db;
