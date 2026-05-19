import type { Client } from "discord.js";
import kickQueueCheck from "../../commands/kick-queue/check";
import { JobHandler, JobRecordLike } from "../types";

export const KICK_QUEUE_SEND_CHECK_MESSAGE_JOB = "kickqueue.send-check-message";

interface JobPayload {
  guildId: string;
  userId: string;
}

function checkMessagePayload(payload: unknown): payload is JobPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "guildId" in payload &&
    "userId" in payload &&
    typeof payload.guildId === "string" &&
    typeof payload.userId === "string"
  );
}

export function createKickQueueHandler(client: Client): JobHandler {
  return async (job: JobRecordLike): Promise<void> => {
    if (!checkMessagePayload(job.payload)) {
      throw new Error("Invalid kickqueue send-check-message job payload");
    }

    const user = await client.users.fetch(job.payload.userId);
    await kickQueueCheck.sendCheckMessage(user, job.payload.guildId);
  };
}
