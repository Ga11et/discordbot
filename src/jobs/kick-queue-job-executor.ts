import type { Client } from "discord.js";
import kickQueueCheck from "../commands/kick-queue-check";
import type { JobQueueRecord } from "./minute-job-queue";

export const KICK_QUEUE_SEND_CHECK_MESSAGE_JOB = "kickqueue.send-check-message";

interface KickQueueSendCheckMessagePayload {
  guildId: string;
  userId: string;
}

function isKickQueueSendCheckMessagePayload(
  payload: unknown,
): payload is KickQueueSendCheckMessagePayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "guildId" in payload &&
    "userId" in payload &&
    typeof payload.guildId === "string" &&
    typeof payload.userId === "string"
  );
}

export function createKickQueueJobExecutor(client: Client) {
  return async function executeKickQueueJob(job: JobQueueRecord): Promise<void> {
    if (job.type !== KICK_QUEUE_SEND_CHECK_MESSAGE_JOB) {
      throw new Error(`Unknown job type: ${job.type}`);
    }

    if (!isKickQueueSendCheckMessagePayload(job.payload)) {
      throw new Error("Invalid kickqueue send-check-message job payload");
    }

    const user = await client.users.fetch(job.payload.userId);
    await kickQueueCheck.sendCheckMessage(user, job.payload.guildId);
  };
}
