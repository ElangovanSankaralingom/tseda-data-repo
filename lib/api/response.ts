import "server-only";

import { NextResponse } from "next/server";
import { normalizeError, httpStatusForCode, type AppErrorCode } from "@/lib/errors";
import { APP_CONFIG } from "@/lib/config/appConfig";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ApiMeta = {
  timestamp: string;
};

export type PaginationMeta = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
  error: null;
  meta: ApiMeta;
};

export type ApiPaginatedResponse<T> = ApiSuccessResponse<T[]> & {
  pagination: PaginationMeta;
};

export type ApiErrorResponse = {
  success: false;
  data: null;
  error: { message: string; code: string; details?: unknown };
  meta: ApiMeta;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function meta(): ApiMeta {
  return { timestamp: new Date().toISOString() };
}

/**
 * Parse pagination query params with defaults.
 */
export function parsePagination(
  searchParams: URLSearchParams | null,
  defaults?: { pageSize?: number },
): { page: number; pageSize: number } {
  const maxPageSize = APP_CONFIG.pagination.maxPageSize;
  const defaultPageSize = defaults?.pageSize ?? APP_CONFIG.pagination.defaultPageSize;

  const rawPage = Number(searchParams?.get("page") ?? 1);
  const rawPageSize = Number(searchParams?.get("pageSize") ?? defaultPageSize);

  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const pageSize = Number.isFinite(rawPageSize) && rawPageSize >= 1
    ? Math.min(Math.floor(rawPageSize), maxPageSize)
    : defaultPageSize;

  return { page, pageSize };
}

/**
 * Apply pagination to an array and return the slice + pagination metadata.
 */
export function paginate<T>(items: T[], page: number, pageSize: number): {
  data: T[];
  pagination: PaginationMeta;
} {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const start = (clampedPage - 1) * pageSize;
  const data = items.slice(start, start + pageSize);

  return {
    data,
    pagination: { total, page: clampedPage, pageSize, totalPages },
  };
}

// ---------------------------------------------------------------------------
// Response builders
// ---------------------------------------------------------------------------

/**
 * Success response with data.
 */
export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(
    { success: true, data, error: null, meta: meta() } satisfies ApiSuccessResponse<T>,
    { status },
  );
}

/**
 * Success response with paginated data.
 */
export function apiPaginated<T>(data: T[], pagination: PaginationMeta, status = 200): NextResponse {
  return NextResponse.json(
    { success: true, data, pagination, error: null, meta: meta() } satisfies ApiPaginatedResponse<T>,
    { status },
  );
}

/**
 * Error response. Accepts an AppErrorCode or raw error.
 */
export function apiError(
  message: string,
  code: AppErrorCode = "UNKNOWN",
  status?: number,
  details?: unknown,
): NextResponse {
  const httpStatus = status ?? httpStatusForCode(code);
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: { message, code, ...(details !== undefined ? { details } : {}) },
      meta: meta(),
    } satisfies ApiErrorResponse,
    { status: httpStatus },
  );
}

/**
 * Convert any caught error into a standard API error response.
 */
export function apiErrorFromCatch(error: unknown, fallbackMessage = "Something went wrong"): NextResponse {
  const appError = normalizeError(error);
  const status = httpStatusForCode(appError.code);
  return apiError(appError.message || fallbackMessage, appError.code, status);
}
