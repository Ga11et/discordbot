import type { Client } from "discord.js";
import type { JobHandler, JobRecordLike } from "../types";
import birthCheck from "../../commands/birth/check";

export const BIRTH_SEND_CHECK_MESSAGE_JOB = "birth.send-check-message";

interface JobPayload {
  guildId: string;
  userId: string;
}

function checkPayload(payload: unknown): payload is JobPayload {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("guildId" in payload) ||
    !("userId" in payload)
  ) {
    return false;
  }

  const { guildId, userId } = payload as JobPayload;
  return (
    (typeof guildId === "string" || typeof guildId === "number") &&
    (typeof userId === "string" || typeof userId === "number")
  );
}

export function createBirthHandler(client: Client): JobHandler {
  return async (job: JobRecordLike): Promise<void> => {
    if (!checkPayload(job.payload)) {
      throw new Error("Invalid birth send-check-message job payload");
    }

    const userId = String(job.payload.userId);
    const guildId = String(job.payload.guildId);

    const user = await client.users.fetch(userId);
    await birthCheck.sendCheckMessage(user, guildId);
  };
}
