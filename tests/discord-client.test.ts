import { describe, expect, it } from "vitest";
import { GatewayIntentBits } from "discord.js";
import discordClient from "../src/discord-client";

describe("discord client configuration", () => {
  it("includes the guild members intent for full guild member fetches", () => {
    expect(discordClient.intents).toContain(GatewayIntentBits.GuildMembers);
  });

  it("returns a singleton client configured with shared intents", () => {
    const client = discordClient.client;
    const sameClient = discordClient.client;

    for (const intent of discordClient.intents) {
      expect(client.options.intents.has(intent)).toBe(true);
    }

    expect(sameClient).toBe(client);

    discordClient.destroy();
  });
});
