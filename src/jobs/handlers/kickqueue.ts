import type { Client } from "discord.js";
import kickQueueCheck from "../../commands/kick-queue/check";
import { JobHandler, JobRecordLike } from "../types";

export const KICK_QUEUE_SEND_CHECK_MESSAGE_JOB = "kickqueue.send-check-message";

interface JobPayload {
  guildId: string;
  userId: string;
}

function checkMessagePayload(payload: unknown): payload is JobPayload {
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

export function createKickQueueHandler(client: Client): JobHandler {
  return async (job: JobRecordLike): Promise<void> => {
    if (!checkMessagePayload(job.payload)) {
      throw new Error("Invalid kickqueue send-check-message job payload");
    }

    const userId = String(job.payload.userId);
    const guildId = String(job.payload.guildId);

    const user = await client.users.fetch(userId);
    await kickQueueCheck.sendCheckMessage(user, guildId);
  };
}
