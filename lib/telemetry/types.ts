import type { CategoryKey } from "@/lib/entries/types";

export const TELEMETRY_VERSION = 1 as const;

export const TELEMETRY_EVENT_NAMES = [
  "entry.create",
  "entry.update",
  "entry.delete",
  "entry.commit_draft",
  "entry.request_edit",
  "entry.grant_edit",
  "entry.view",
  "entry.search",
  "upload.start",
  "upload.success",
  "upload.failure",
  "upload.remove",
  "autosave.success",
  "autosave.failure",
  "confirmation.dialog_opened",
  "unsaved_changes.prompt_shown",
  "action.failure",
  "validation.failure",
  "rate_limit.hit",
  "payload.too_large",
  "page.dashboard_view",
  "page.entry_list_view",
  "page.entry_detail_view",
  "page.admin_console_view",
  "page.analytics_view",
] as const;

export type TelemetryEventName = (typeof TELEMETRY_EVENT_NAMES)[number];

const TELEMETRY_EVENT_SET = new Set<string>(TELEMETRY_EVENT_NAMES);

export function isTelemetryEventName(value: string): value is TelemetryEventName {
  return TELEMETRY_EVENT_SET.has(value);
}

export type TelemetryActorRole = "user" | "admin";

export type TelemetryMetaValue = string | number | boolean | null;
export type TelemetryMeta = Record<string, TelemetryMetaValue | undefined>;

export type TelemetryEvent = {
  v: number;
  ts: string;
  event: TelemetryEventName;
  actorEmail: string;
  role: TelemetryActorRole;
  category: CategoryKey | string | null;
  entryId: string | null;
  status: string | null;
  success: boolean;
  durationMs: number | null;
  meta: TelemetryMeta;
};

export type TelemetryEventInput = {
  event: TelemetryEventName;
  actorEmail: string;
  role?: TelemetryActorRole;
  category?: CategoryKey | string | null;
  entryId?: string | null;
  status?: string | null;
  success?: boolean;
  durationMs?: number | null;
  meta?: TelemetryMeta;
  ts?: string;
};

export type ReadTelemetryEventsOptions = {
  limit?: number;
  sinceISO?: string;
  events?: TelemetryEventName[];
};

export type TelemetrySummary = {
  generatedAt: string;
  totalEvents: number;
  eventsByName: Record<string, number>;
  usageByCategory: Record<string, number>;
  actionsByCount: Array<{ event: string; count: number }>;
  failuresByAction: Array<{ event: string; count: number }>;
  failuresByErrorCode: Array<{ errorCode: string; count: number }>;
  funnel: {
    created: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  dropOff: {
    createdNotSent: number;
    pendingTooLong: number;
    uploadStartedWithoutCommit: number;
  };
  turnaround: {
    draftToPendingAvgMs: number | null;
    draftToPendingSamples: number;
    pendingToApprovedAvgMs: number | null;
    pendingToApprovedSamples: number;
  };
  recentFailures: TelemetryEvent[];
  recentEvents: TelemetryEvent[];
};
