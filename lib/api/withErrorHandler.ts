import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { logger } from "@/lib/logger";

type RouteHandler = (request: NextRequest | Request) => Promise<NextResponse>;

/**
 * Wraps an API route handler with consistent error handling.
 *
 * - Catches all errors (sync and async)
 * - Maps AppError codes to HTTP status codes
 * - Returns consistent error envelope
 * - Logs every error with context (never leaks stack traces to client)
 */
export function withErrorHandler(handler: RouteHandler, label: string): RouteHandler {
  return async (request) => {
    const startedAt = Date.now();
    try {
      return await handler(request);
    } catch (error) {
      const appError = normalizeError(error);
      const status = httpStatusForCode(appError.code);
      const durationMs = Date.now() - startedAt;

      logger.error({
        event: "api.error",
        label,
        errorCode: appError.code,
        status: String(status),
        method: request.method,
        url: request.url,
        durationMs,
      }, appError.message);

      return NextResponse.json(
        {
          success: false,
          data: null,
          error: {
            message: appError.message,
            code: appError.code,
          },
        },
        { status },
      );
    }
  };
}
