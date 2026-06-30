import { AppError } from "./errors";

export default class DateUtils {
  public toIsoDateString(date: Date): string {
    const normalized = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
    return normalized.toISOString();
  }

  public fromIsoDateString(value: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new AppError("INVALID_DB_VALUE");
    }
    return parsed;
  }

  public formatDateDisplay(date: Date): string {
    return `${this.formatNumber(date.getUTCDate())}.${this.formatNumber(date.getUTCMonth() + 1)}.${date.getUTCFullYear()}`;
  }

  public parseDateInput(raw: string): Date {
    const trimmed = raw.trim();
    const match = /^([0-3]\d)\.([0-1]\d)\.(\d{4})$/.exec(trimmed);
    if (!match) {
      throw new AppError("INVALID_FORMAT");
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
      throw new AppError("INVALID_DATE");
    }

    const today = new Date();
    const todayUTC = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    if (date > todayUTC) {
      throw new AppError("FUTURE_DATE");
    }

    return date;
  }

  public parseDayMonth(raw: string): Date {
    const trimmed = raw.trim();
    const match = /^([0-3]\d)\.([0-1]\d)$/.exec(trimmed);
    if (!match) {
      throw new AppError("INVALID_FORMAT");
    }

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = 2000;

    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new AppError("INVALID_DATE");
    }

    return date;
  }

  public formatDayMonth(date: Date): string {
    return `${this.formatNumber(date.getUTCDate())}.${this.formatNumber(date.getUTCMonth() + 1)}`;
  }

  private formatNumber(value: number): string {
    return value.toString().padStart(2, "0");
  }
}

export const dateUtils = new DateUtils();
