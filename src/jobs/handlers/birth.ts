import type { Client } from "discord.js";
import type { JobHandler, JobRecordLike } from "../types";
import birthCheck from "../../commands/birth/check";

export const BIRTH_SEND_CHECK_MESSAGE_JOB = "birth.send-check-message";

interface JobPayload {
  guildId: string;
  userId: string;
}

function checkPayload(payload: unknown): payload is JobPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "guildId" in payload &&
    "userId" in payload &&
    typeof (payload as JobPayload).guildId === "string" &&
    typeof (payload as JobPayload).userId === "string"
  );
}

export function createBirthHandler(client: Client): JobHandler {
  return async (job: JobRecordLike): Promise<void> => {
    if (!checkPayload(job.payload)) {
      throw new Error("Invalid birth send-check-message job payload");
    }

    const user = await client.users.fetch(job.payload.userId);
    await birthCheck.sendCheckMessage(user, job.payload.guildId);
  };
}
