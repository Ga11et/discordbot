import type { Knex } from "knex";
import { createKnexClient, runMigrationsOnClient } from "../../src/db";

let client: Knex | null = null;

function createTestClient(): Knex {
  const {
    POSTGRES_TEST_HOST = "localhost",
    POSTGRES_TEST_PORT = "5433",
    POSTGRES_TEST_DB = "discordbot_db_test",
    POSTGRES_TEST_USER = "discordbot_user_test",
    POSTGRES_TEST_PASSWORD = "discordbot_pass_test",
  } = process.env;

  return createKnexClient({
    host: POSTGRES_TEST_HOST,
    port: Number(POSTGRES_TEST_PORT),
    database: POSTGRES_TEST_DB,
    user: POSTGRES_TEST_USER,
    password: POSTGRES_TEST_PASSWORD,
  });
}

export function getTestClient(): Knex {
  if (!client) {
    client = createTestClient();
  }
  return client;
}

export async function setupTestDb(): Promise<void> {
  const testClient = getTestClient();
  await runMigrationsOnClient(testClient);
}

export async function resetBirthdaysTable(): Promise<void> {
  const testClient = getTestClient();
  await testClient("birthdays").truncate();
}

export async function resetGratzMessagesTable(): Promise<void> {
  const testClient = getTestClient();
  await testClient("birthday_gratz_messages").truncate();
}

export async function closeTestDb(): Promise<void> {
  if (!client) return;
  await client.destroy();
  client = null;
}
