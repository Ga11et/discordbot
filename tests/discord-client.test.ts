import { describe, expect, it } from "vitest";
import { GatewayIntentBits } from "discord.js";
import { CLIENT_INTENTS, createDiscordClient } from "../src/discord-client";

describe("discord client configuration", () => {
  it("includes the guild members intent for full guild member fetches", () => {
    expect(CLIENT_INTENTS).toContain(GatewayIntentBits.GuildMembers);
  });

  it("creates a client configured with the shared intents", () => {
    const client = createDiscordClient();

    for (const intent of CLIENT_INTENTS) {
      expect(client.options.intents.has(intent)).toBe(true);
    }

    client.destroy();
  });
});
