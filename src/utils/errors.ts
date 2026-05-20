export type AppErrorCode =
  | "NOT_FOUND"
  | "INVALID_FORMAT"
  | "INVALID_DATE"
  | "FUTURE_DATE"
  | "INVALID_DB_VALUE"
  | "INVALID_INPUT"
  | "EMPTY_VALUE"
  | "INTERNAL_ERROR";

const DEFAULT_MESSAGES: Record<AppErrorCode, string> = {
  NOT_FOUND: "Ресурс не найден",
  INVALID_FORMAT: "Некорректный формат данных",
  INVALID_DATE: "Некорректная дата",
  FUTURE_DATE: "Дата не может быть из будущего",
  INVALID_DB_VALUE: "Некорректное значение в базе данных",
  INVALID_INPUT: "Некорректный ввод",
  EMPTY_VALUE: "Значение не может быть пустым",
  INTERNAL_ERROR: "Внутренняя ошибка",
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly userMessage: string;

  constructor(code: AppErrorCode, overrideMessage?: string) {
    const fallback = DEFAULT_MESSAGES[code];
    super(overrideMessage ?? fallback);
    this.name = "AppError";
    this.code = code;
    this.userMessage = overrideMessage ?? fallback;
  }
}
