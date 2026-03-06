"use client";

import type { TelemetryEventInput, TelemetryMeta, TelemetryEventName } from "@/lib/telemetry/types";

type ClientTelemetryEventInput = {
  event: TelemetryEventName;
  category?: TelemetryEventInput["category"];
  entryId?: string | null;
  status?: string | null;
  success?: boolean;
  durationMs?: number | null;
  meta?: TelemetryMeta;
};

function buildPayload(input: ClientTelemetryEventInput) {
  return {
    event: input.event,
    category: input.category ?? null,
    entryId: input.entryId ?? null,
    status: input.status ?? null,
    success: input.success ?? true,
    durationMs: input.durationMs ?? null,
    meta: input.meta ?? {},
  };
}

export async function trackClientTelemetryEvent(input: ClientTelemetryEventInput) {
  try {
    await fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      keepalive: true,
      body: JSON.stringify(buildPayload(input)),
    });
  } catch {
    // Telemetry is best-effort and should never block UX paths.
  }
}

export function beaconClientTelemetryEvent(input: ClientTelemetryEventInput) {
  try {
    if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
      return;
    }
    const payload = JSON.stringify(buildPayload(input));
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon("/api/telemetry", blob);
  } catch {
    // Telemetry is best-effort and should never block UX paths.
  }
}

