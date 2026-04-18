import { BirthdayCommandError } from "./errors";

function formatNumber(value: number): string {
  return value.toString().padStart(2, "0");
}

export const birthdayDateUtils = {
  toIsoUtcDateString,
  fromIsoUtcDateString,
  formatBirthdayDisplay,
  parseBirthdayInput,
};

export type BirthdayDateUtils = typeof birthdayDateUtils;

export function toIsoUtcDateString(date: Date): string {
  const normalized = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  return normalized.toISOString();
}

export function fromIsoUtcDateString(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BirthdayCommandError("INVALID_DB_VALUE");
  }
  return parsed;
}

export function formatBirthdayDisplay(date: Date): string {
  return `${formatNumber(date.getUTCDate())}.${formatNumber(date.getUTCMonth() + 1)}.${date.getUTCFullYear()}`;
}

export function parseBirthdayInput(raw: string): Date {
  const trimmed = raw.trim();
  const match = /^([0-3]\d)\.([0-1]\d)\.(\d{4})$/.exec(trimmed);
  if (!match) {
    throw new BirthdayCommandError("INVALID_FORMAT");
  }

  const [, dayString, monthString, yearString] = match;
  const day = Number(dayString);
  const month = Number(monthString);
  const year = Number(yearString);

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new BirthdayCommandError("INVALID_DATE");
  }

  const today = new Date();
  const todayUTC = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  if (date > todayUTC) {
    throw new BirthdayCommandError("FUTURE_DATE");
  }

  return date;
}
