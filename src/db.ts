import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { types } from "pg";
import knex, { type Knex } from "knex";

const TIMESTAMPTZ_OID = 1184;
types.setTypeParser(TIMESTAMPTZ_OID, (value) => value);

type ConnectionOverrides = Partial<Knex.PgConnectionConfig>;

function resolveDefaultConnection(): Knex.PgConnectionConfig {
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

export function createKnexClient(overrides?: ConnectionOverrides): Knex {
  const baseConnection = resolveDefaultConnection();
  const connection = {
    ...baseConnection,
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

export const db = createKnexClient();

/**
 * Performs a lightweight connectivity check to ensure the pool can reach PostgreSQL.
 */
export async function ensureDatabaseConnection(): Promise<void> {
  await db.raw("SELECT 1");
  console.log("Подключение к PostgreSQL установлено");
}

function loadMigrationFiles(): string[] {
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

export async function runMigrationsOnClient(targetDb: Knex): Promise<void> {
  const migrations = loadMigrationFiles();
  for (const sql of migrations) {
    await targetDb.raw(sql);
  }
}

export async function runMigrations(): Promise<void> {
  await runMigrationsOnClient(db);
}
