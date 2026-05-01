import "dotenv/config";
import { bootstrap } from "./bootstrap";

let isShuttingDown = false;

async function shutdown(
  signal: NodeJS.Signals,
  stop: () => Promise<void>,
): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`Получен сигнал ${signal}, начинаю завершение работы...`);

  try {
    await stop();
    process.exit(0);
  } catch (error) {
    console.error("Ошибка при завершении работы", error);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const runtime = await bootstrap();

  process.once("SIGINT", () => {
    void shutdown("SIGINT", runtime.stop);
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM", runtime.stop);
  });
}

void main().catch((error) => {
  console.error("Не удалось запустить бота", error);
  process.exit(1);
});
