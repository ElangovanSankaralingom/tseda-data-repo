"use client";

import type { Dispatch, SetStateAction } from "react";
import type { CategoryKey } from "@/lib/entries/types";
import type { TelemetryEventName } from "@/lib/telemetry/types";
import { trackClientTelemetryEvent } from "@/lib/telemetry/client";
import {
  createOptimisticSnapshot,
  optimisticRemove,
} from "@/lib/ui/optimistic";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function mapStatusToErrorCode(status: number): string {
  if (status === 400) return "VALIDATION_ERROR";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 429) return "RATE_LIMITED";
  return "IO_ERROR";
}

const SUB_EVENT_MAP: Record<string, TelemetryEventName> = {
  VALIDATION_ERROR: "validation.failure",
  RATE_LIMITED: "rate_limit.hit",
  PAYLOAD_TOO_LARGE: "payload.too_large",
};

async function parseResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<{ message: string; payload: T | null }> {
  const text = await response.text();
  let message = `${fallbackMessage} (${response.status})`;
  let payload: T | null = null;

  try {
    const parsed = text ? JSON.parse(text) : null;
    if (parsed && typeof parsed === "object") {
      // Support envelope format: { success, data, error }
      if ("data" in parsed && parsed.data !== null && parsed.data !== undefined) {
        payload = parsed.data as T;
      } else {
        payload = parsed as T;
      }
      // Extract error message from envelope or legacy format
      const errorField = parsed.error;
      if (typeof errorField === "string" && errorField) {
        message = errorField;
      } else if (errorField && typeof errorField === "object" && typeof errorField.message === "string") {
        message = errorField.message;
      }
    }
  } catch {
    payload = null;
  }

  return { message, payload };
}

// ---------------------------------------------------------------------------
// createRefreshList
// ---------------------------------------------------------------------------

type RefreshListConfig<T> = {
  endpoint: string;
  queryParams?: () => Record<string, string>;
  normalizeItems: (items: unknown[]) => T[];
  setList: Dispatch<SetStateAction<T[]>>;
};

export function createRefreshList<T>(
  config: RefreshListConfig<T>,
): () => Promise<T[]> {
  return async () => {
    const params = config.queryParams?.() ?? {};
    const query = new URLSearchParams(params).toString();
    const url = query ? `${config.endpoint}?${query}` : config.endpoint;

    const response = await fetch(url, { cache: "no-store" });
    const body = await response.json();

    if (!response.ok) {
      const errMsg =
        (body as { error?: { message?: string } | string })?.error;
      throw new Error(
        (typeof errMsg === "object" ? errMsg?.message : errMsg) ||
          "Failed to refresh saved entries.",
      );
    }

    // Support both envelope { data: [...] } and legacy plain array responses
    const items = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
    const normalized = config.normalizeItems(items);
    config.setList(normalized);
    return normalized;
  };
}

// ---------------------------------------------------------------------------
// createPersistProgress
// ---------------------------------------------------------------------------

type PersistProgressConfig<T> = {
  endpoint: string;
  category: CategoryKey;
  buildBody: (entry: T) => Record<string, unknown>;
  normalizeResponse: (data: unknown) => T;
};

export function createPersistProgress<T extends Record<string, unknown>>(
  config: PersistProgressConfig<T>,
): (entry: T) => Promise<T> {
  return async (nextForm: T) => {
    const startedAt = Date.now();
    const eventName: TelemetryEventName = String(
      nextForm.createdAt ?? "",
    ).trim()
      ? "entry.update"
      : "entry.create";
    const entryId = String(nextForm.id ?? "").trim() || null;

    const response = await fetch(config.endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config.buildBody(nextForm)),
    });
    const { message, payload } = await parseResponse<T>(
      response,
      "Save failed",
    );

    if (!response.ok) {
      const errorCode = mapStatusToErrorCode(response.status);
      void trackClientTelemetryEvent({
        event: "action.failure",
        category: config.category,
        entryId,
        success: false,
        durationMs: Date.now() - startedAt,
        meta: {
          action: eventName,
          source: "manual",
          errorCode,
          statusCode: response.status,
        },
      });
      const subEvent = SUB_EVENT_MAP[errorCode];
      if (subEvent) {
        void trackClientTelemetryEvent({
          event: subEvent,
          category: config.category,
          entryId,
          success: false,
          durationMs: Date.now() - startedAt,
          meta: { action: eventName, source: "manual", errorCode },
        });
      }
      throw new Error(message);
    }

    const persisted = config.normalizeResponse(payload);
    void trackClientTelemetryEvent({
      event: eventName,
      category: config.category,
      entryId:
        String((persisted as Record<string, unknown>)?.id ?? nextForm.id ?? "").trim() ||
        null,
      status:
        String(
          (persisted as Record<string, unknown>)?.confirmationStatus ??
            nextForm.confirmationStatus ??
            "",
        ).trim() || null,
      success: true,
      durationMs: Date.now() - startedAt,
      meta: { source: "manual" },
    });

    return persisted;
  };
}

// ---------------------------------------------------------------------------
// createDeleteEntry
// ---------------------------------------------------------------------------

type DeleteEntryConfig<T extends { id?: unknown }> = {
  endpoint: string;
  category: CategoryKey;
  buildBody: (id: string) => Record<string, unknown>;
  setList: Dispatch<SetStateAction<T[]>>;
  refreshList: () => Promise<unknown>;
  onDeletedActiveEntry?: (id: string) => void;
  showToast: (type: "ok" | "err", msg: string, duration: number) => void;
};

export function createDeleteEntry<T extends { id?: unknown }>(
  config: DeleteEntryConfig<T>,
): (id: string) => Promise<void> {
  return async (id: string) => {
    const startedAt = Date.now();
    let failureTracked = false;
    let rollbackSnapshot: T[] | null = null;

    config.setList((current) => {
      rollbackSnapshot = createOptimisticSnapshot(current);
      return optimisticRemove(current, id);
    });

    try {
      const response = await fetch(config.endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config.buildBody(id)),
      });
      const responsePayload = (await response.json()) as {
        error?: string | { message?: string };
      } | null;

      if (!response.ok) {
        const errorCode = mapStatusToErrorCode(response.status);
        void trackClientTelemetryEvent({
          event: "action.failure",
          category: config.category,
          entryId: id,
          success: false,
          durationMs: Date.now() - startedAt,
          meta: {
            action: "entry.delete",
            source: "manual",
            errorCode,
            statusCode: response.status,
          },
        });
        failureTracked = true;
        const errField = responsePayload?.error;
        const errMsg = typeof errField === "string" ? errField : errField?.message;
        throw new Error(errMsg || "Delete failed.");
      }

      void trackClientTelemetryEvent({
        event: "entry.delete",
        category: config.category,
        entryId: id,
        success: true,
        durationMs: Date.now() - startedAt,
        meta: { source: "manual" },
      });
      config.setList((current) => optimisticRemove(current, id));
      void config.refreshList();
      config.onDeletedActiveEntry?.(id);
      config.showToast("ok", "Entry deleted.", 1200);
    } catch (error) {
      if (rollbackSnapshot) {
        config.setList(rollbackSnapshot);
      }
      if (!failureTracked) {
        void trackClientTelemetryEvent({
          event: "action.failure",
          category: config.category,
          entryId: id,
          success: false,
          durationMs: Date.now() - startedAt,
          meta: {
            action: "entry.delete",
            source: "manual",
            errorCode: "IO_ERROR",
          },
        });
      }
      const message =
        error instanceof Error ? error.message : "Delete failed.";
      config.showToast("err", message, 1500);
    }
  };
}
