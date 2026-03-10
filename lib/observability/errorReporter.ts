import "server-only";

import { normalizeError, type AppErrorCode } from "@/lib/errors";
import { getCurrentRequestId } from "@/lib/api/asyncContext";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Error reporting abstraction (Sentry-ready)
//
// Currently logs to the structured logger. When Sentry is added, replace the
// body of `reportError` with Sentry.captureException while keeping the same
// interface.
// ---------------------------------------------------------------------------

type ErrorReportContext = {
  /** Where the error occurred (e.g. "api.health", "engine.write") */
  source: string;
  /** User email if available */
  userEmail?: string;
  /** Request path */
  path?: string;
  /** HTTP method */
  method?: string;
  /** Additional context */
  meta?: Record<string, unknown>;
};

/**
 * Report an error through the centralized error pipeline.
 *
 * Every unhandled/caught error should go through this single function
 * so that switching to Sentry (or another provider) requires only
 * changing this implementation.
 */
export function reportError(error: unknown, context: ErrorReportContext): void {
  const appError = normalizeError(error);
  const requestId = getCurrentRequestId();

  logger.error({
    event: "error.reported",
    errorCode: appError.code,
    requestId,
    source: context.source,
    ...(context.userEmail ? { userEmail: context.userEmail } : {}),
    ...(context.path ? { path: context.path } : {}),
    ...(context.method ? { method: context.method } : {}),
    ...(context.meta ?? {}),
  }, appError.message);

  // -----------------------------------------------------------------------
  // Sentry integration point:
  //
  //   Sentry.withScope((scope) => {
  //     scope.setTag("errorCode", appError.code);
  //     scope.setExtra("requestId", requestId);
  //     scope.setExtra("source", context.source);
  //     if (context.userEmail) scope.setUser({ email: context.userEmail });
  //     Sentry.captureException(error);
  //   });
  // -----------------------------------------------------------------------
}

/**
 * Report a warning-level issue (not a thrown error, but something noteworthy).
 */
export function reportWarning(
  message: string,
  code: AppErrorCode,
  context: ErrorReportContext,
): void {
  const requestId = getCurrentRequestId();

  logger.warn({
    event: "warning.reported",
    errorCode: code,
    requestId,
    source: context.source,
    ...(context.userEmail ? { userEmail: context.userEmail } : {}),
    ...(context.path ? { path: context.path } : {}),
    ...(context.meta ?? {}),
  }, message);
}
