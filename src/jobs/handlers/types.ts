export interface JobRecordLike {
  type: string;
  payload: unknown;
}

export type JobHandler = (job: JobRecordLike) => Promise<void>;
