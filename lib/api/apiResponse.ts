import { NextResponse } from "next/server";
import { AUTH } from "@/lib/constants/messages";

type ApiSuccessOptions = {
  status?: number;
  headers?: Record<string, string>;
};

type ApiErrorOptions = {
  status?: number;
  code?: string;
};

export function apiSuccess<T>(data: T, options: ApiSuccessOptions = {}) {
  return NextResponse.json(
    { ok: true, data },
    { status: options.status ?? 200, headers: options.headers }
  );
}

export function cachedApiSuccess<T>(data: T, maxAge: number, staleWhileRevalidate?: number) {
  const cacheControl = staleWhileRevalidate
    ? `private, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`
    : `private, max-age=${maxAge}`;
  return apiSuccess(data, { headers: { "Cache-Control": cacheControl } });
}

export function apiError(message: string, options: ApiErrorOptions = {}) {
  return NextResponse.json(
    { ok: false, error: { message, code: options.code ?? "UNKNOWN" } },
    { status: options.status ?? 400 }
  );
}

export function apiUnauthorized(message = AUTH.unauthorized) {
  return apiError(message, { status: 401, code: "UNAUTHORIZED" });
}

export function apiForbidden(message = AUTH.accessDenied) {
  return apiError(message, { status: 403, code: "FORBIDDEN" });
}
