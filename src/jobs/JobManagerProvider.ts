import type { Knex } from "knex";
import JobManager from "./JobManager";

let jobManager: JobManager | null = null;

function init(client: Knex): JobManager {
  if (jobManager) {
    return jobManager;
  }

  jobManager = new JobManager(client);
  return jobManager;
}

function get(): JobManager {
  if (!jobManager) {
    throw new Error(
      "JobManager is not initialized. Call JobManagerInstance.init(db.client) at app startup.",
    );
  }

  return jobManager;
}

const JobManagerInstance = {
  init,
  get,
};

export default JobManagerInstance;
