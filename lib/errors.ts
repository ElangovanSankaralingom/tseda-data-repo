export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "UPLOAD_FAILED"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "IO_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN";

type AppErrorInput = {
  code?: AppErrorCode;
  message: string;
  details?: unknown;
  cause?: unknown;
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details?: unknown;

  constructor({ code = "UNKNOWN", message, details, cause }: AppErrorInput) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

function codeFromMessage(message: string): AppErrorCode {
  const lower = message.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("too many requests")) return "RATE_LIMITED";
  if (lower.includes("payload too large") || lower.includes("request too large")) return "PAYLOAD_TOO_LARGE";
  if (lower.includes("unauthorized") || lower.includes("sign in")) return "UNAUTHORIZED";
  if (lower.includes("forbidden") || lower.includes("permission")) return "FORBIDDEN";
  if (lower.includes("not found") || lower.includes("missing")) return "NOT_FOUND";
  if (lower.includes("validation") || lower.includes("required") || lower.includes("invalid")) return "VALIDATION_ERROR";
  if (lower.includes("upload")) return "UPLOAD_FAILED";
  if (lower.includes("network")) return "NETWORK_ERROR";
  if (lower.includes("io") || lower.includes("write") || lower.includes("read")) return "IO_ERROR";
  return "UNKNOWN";
}

export function normalizeError(error: unknown): AppError {
  if (isAppError(error)) return error;

  if (error && typeof error === "object") {
    const input = error as { code?: unknown; message?: unknown; details?: unknown };
    const message =
      typeof input.message === "string" && input.message.trim()
        ? input.message
        : "Something went wrong. Please try again.";
    const code =
      typeof input.code === "string"
        ? (input.code as AppErrorCode)
        : codeFromMessage(message);

    return new AppError({
      code,
      message,
      details: input.details,
      cause: error,
    });
  }

  if (typeof error === "string" && error.trim()) {
    return new AppError({
      code: codeFromMessage(error),
      message: error,
      cause: error,
    });
  }

  return new AppError({
    code: "UNKNOWN",
    message: "Something went wrong. Please try again.",
    cause: error,
  });
}

export function toUserMessage(error: unknown): string {
  const appError = normalizeError(error);

  if (appError.code === "VALIDATION_ERROR") return appError.message || "Please check the highlighted fields.";
  if (appError.code === "RATE_LIMITED") return appError.message || "Too many requests. Please try again shortly.";
  if (appError.code === "PAYLOAD_TOO_LARGE") return "The request is too large. Reduce the input size and try again.";
  if (appError.code === "UNAUTHORIZED") return "Please sign in and try again.";
  if (appError.code === "FORBIDDEN") return "You do not have permission to perform this action.";
  if (appError.code === "NOT_FOUND") return "The requested record was not found.";
  if (appError.code === "UPLOAD_FAILED") return "Upload failed. Please try again.";
  if (appError.code === "NETWORK_ERROR") return "Network issue detected. Check your connection and retry.";
  if (appError.code === "IO_ERROR") return "Unable to save right now. Please try again.";

  return appError.message || "Something went wrong. Please try again.";
}

export function logError(error: unknown, context = "app"): AppError {
  const appError = normalizeError(error);
  const details =
    appError.details === undefined
      ? undefined
      : Array.isArray(appError.details)
        ? { type: "array", count: appError.details.length }
        : typeof appError.details === "object" && appError.details !== null
          ? { type: "object", keys: Object.keys(appError.details as Record<string, unknown>).slice(0, 20) }
          : appError.details;

  const payload = {
    level: "error",
    ts: new Date().toISOString(),
    event: "app.error",
    context,
    errorCode: appError.code,
    msg: appError.message,
    details,
  };

  console.error(JSON.stringify(payload));

  return appError;
}
