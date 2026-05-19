import type { Client } from "discord.js";
import {
  KICK_QUEUE_SEND_CHECK_MESSAGE_JOB,
  createKickQueueHandler,
} from "./handlers/kickqueue";
import { JobHandler } from "./types";

type JobHandlerMap = Record<string, JobHandler>;

export default class JobHandlers {
  constructor(private readonly client: Client) {}

  public handlers(): JobHandlerMap {
    return {
      [KICK_QUEUE_SEND_CHECK_MESSAGE_JOB]: createKickQueueHandler(this.client),
    };
  }
}
