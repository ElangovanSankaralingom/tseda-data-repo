import { NextResponse } from "next/server";
import { AUTH } from "@/lib/constants/messages";

type ApiSuccessOptions = {
  status?: number;
};

type ApiErrorOptions = {
  status?: number;
  code?: string;
};

export function apiSuccess<T>(data: T, options: ApiSuccessOptions = {}) {
  return NextResponse.json(
    { ok: true, data },
    { status: options.status ?? 200 }
  );
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

export function apiNotFound(message = "Not found") {
  return apiError(message, { status: 404, code: "NOT_FOUND" });
}

export function apiServerError(message = "Internal server error") {
  return apiError(message, { status: 500, code: "INTERNAL_ERROR" });
}
