export type BirthdayErrorCode =
  | "NOT_FOUND"
  | "INVALID_FORMAT"
  | "INVALID_DATE"
  | "FUTURE_DATE"
  | "INVALID_DB_VALUE";

const DEFAULT_MESSAGES: Record<BirthdayErrorCode, string> = {
  NOT_FOUND: "Дата рождения не найдена. Установи её командой /bd set",
  INVALID_FORMAT: "Используй формат даты ДД.ММ.ГГГГ, например 16.01.1998",
  INVALID_DATE: "Такой даты не существует",
  FUTURE_DATE: "Дата рождения не может быть из будущего",
  INVALID_DB_VALUE: "Некорректное значение даты в базе данных",
};

export class BirthdayCommandError extends Error {
  readonly code: BirthdayErrorCode;
  readonly userMessage: string;

  constructor(code: BirthdayErrorCode, overrideMessage?: string) {
    const fallback = DEFAULT_MESSAGES[code];
    super(overrideMessage ?? fallback);
    this.name = "BirthdayCommandError";
    this.code = code;
    this.userMessage = overrideMessage ?? fallback;
  }
}
