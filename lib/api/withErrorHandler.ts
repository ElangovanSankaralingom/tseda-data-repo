import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { runWithRequestContext, getCurrentRequestId } from "@/lib/api/asyncContext";
import { reportError } from "@/lib/observability/errorReporter";

type RouteHandler = (request: NextRequest | Request) => Promise<NextResponse>;

/**
 * Wraps an API route handler with:
 * - Request-scoped async context (requestId)
 * - Response timing & structured logging
 * - Consistent error envelope
 * - x-request-id response header
 */
export function withErrorHandler(handler: RouteHandler, label: string): RouteHandler {
  return async (request) => {
    // Check for client-provided request ID
    const incomingId =
      request.headers.get("x-request-id") ?? undefined;

    return runWithRequestContext(async () => {
      const requestId = getCurrentRequestId();
      const startedAt = Date.now();
      const method = request.method;
      const url = request.url;
      const path = new URL(url).pathname;

      try {
        const response = await handler(request);
        const durationMs = Date.now() - startedAt;

        // Log every completed request
        logger.info({
          event: "api.request",
          label,
          method,
          path,
          status: String(response.status),
          durationMs,
          requestId,
        });

        // Attach request ID to response
        response.headers.set("x-request-id", requestId);
        return response;
      } catch (error) {
        const appError = normalizeError(error);
        const status = httpStatusForCode(appError.code);
        const durationMs = Date.now() - startedAt;

        reportError(error, {
          source: `api.${label}`,
          path,
          method,
        });

        logger.error({
          event: "api.error",
          label,
          errorCode: appError.code,
          status: String(status),
          method,
          path,
          durationMs,
          requestId,
        }, appError.message);

        const response = NextResponse.json(
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
        response.headers.set("x-request-id", requestId);
        return response;
      }
    }, incomingId);
  };
}
