import { createApp } from "./app";
import db from "./db";

export async function bootstrap() {
  await db.ensureConnection();
  await db.runMigrations();

  const app = await createApp();

  let isStopped = false;

  return {
    async stop(): Promise<void> {
      if (isStopped) {
        return;
      }

      isStopped = true;

      await app.stop();
      await db.closeConnection();
    },
  };
}
