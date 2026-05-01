import type { Client } from "discord.js";

export function handleClientReady(readyClient: Client<true>): void {
  console.log(`Бот запущен как ${readyClient.user.tag}`);
}
