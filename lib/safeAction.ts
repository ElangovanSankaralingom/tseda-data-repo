import { logError, normalizeError, type AppError } from "@/lib/errors";
import { err, ok, type Result } from "@/lib/result";

type SafeActionOptions = {
  context?: string;
  onError?: (error: AppError) => void;
  log?: boolean;
};

export async function safeAction<T>(
  action: () => Promise<T> | T,
  options: SafeActionOptions = {}
): Promise<Result<T>> {
  try {
    const data = await action();
    return ok(data);
  } catch (error) {
    const normalized = normalizeError(error);
    if (options.log ?? true) {
      logError(normalized, options.context ?? "safeAction");
    }
    options.onError?.(normalized);
    return err(normalized);
  }
}
