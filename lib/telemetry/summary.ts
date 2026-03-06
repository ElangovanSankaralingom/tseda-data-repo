import type { TelemetryEvent, TelemetrySummary } from "@/lib/telemetry/types";

function parseTime(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function inc(target: Record<string, number>, key: string, amount = 1) {
  target[key] = (target[key] ?? 0) + amount;
}

function ownerFromEvent(event: TelemetryEvent) {
  const owner = event.meta.ownerEmail;
  if (typeof owner === "string" && owner.trim()) {
    return owner.trim().toLowerCase();
  }
  return event.actorEmail;
}

function entryKey(event: TelemetryEvent) {
  if (!event.entryId || !event.category) return "";
  return `${ownerFromEvent(event)}:${event.category}:${event.entryId}`;
}

function sortCountEntries(map: Record<string, number>) {
  return Object.entries(map)
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.key.localeCompare(right.key);
    });
}

export function buildTelemetrySummaryFromEvents(events: TelemetryEvent[]): TelemetrySummary {
  const nowISO = new Date().toISOString();
  const eventsAsc = [...events].sort((left, right) => parseTime(left.ts) - parseTime(right.ts));
  const eventsDesc = [...eventsAsc].reverse();

  const eventsByName: Record<string, number> = {};
  const usageByCategory: Record<string, number> = {};
  const failuresByActionMap: Record<string, number> = {};
  const failuresByErrorCodeMap: Record<string, number> = {};

  const created = new Set<string>();
  const pending = new Set<string>();
  const approved = new Set<string>();
  const rejected = new Set<string>();
  const committed = new Set<string>();
  const uploadStarted = new Set<string>();

  const createdAtByKey = new Map<string, number>();
  const pendingAtByKey = new Map<string, number>();
  const approvedAtByKey = new Map<string, number>();

  let draftToPendingTotal = 0;
  let draftToPendingSamples = 0;
  let pendingToApprovedTotal = 0;
  let pendingToApprovedSamples = 0;

  for (const event of eventsAsc) {
    inc(eventsByName, event.event);
    if (event.category) {
      inc(usageByCategory, event.category);
    }

    const key = entryKey(event);
    const eventTime = parseTime(event.ts);

    if (key) {
      if (event.event === "entry.create") {
        created.add(key);
        if (!createdAtByKey.has(key) && eventTime > 0) {
          createdAtByKey.set(key, eventTime);
        }
      }
      if (event.event === "entry.commit_draft") {
        committed.add(key);
      }
      if (event.event === "entry.send_for_confirmation") {
        pending.add(key);
        if (!pendingAtByKey.has(key) && eventTime > 0) {
          pendingAtByKey.set(key, eventTime);
        }
        const createdAt = createdAtByKey.get(key);
        if (createdAt && eventTime >= createdAt) {
          draftToPendingTotal += eventTime - createdAt;
          draftToPendingSamples += 1;
        }
      }
      if (event.event === "entry.approve") {
        approved.add(key);
        if (!approvedAtByKey.has(key) && eventTime > 0) {
          approvedAtByKey.set(key, eventTime);
        }
        const pendingAt = pendingAtByKey.get(key);
        if (pendingAt && eventTime >= pendingAt) {
          pendingToApprovedTotal += eventTime - pendingAt;
          pendingToApprovedSamples += 1;
        }
      }
      if (event.event === "entry.reject") {
        rejected.add(key);
      }
      if (event.event === "upload.start") {
        uploadStarted.add(key);
      }
    }

    const isFailureEvent =
      event.success === false ||
      event.event === "action.failure" ||
      event.event === "validation.failure" ||
      event.event === "rate_limit.hit" ||
      event.event === "payload.too_large" ||
      event.event === "upload.failure" ||
      event.event === "autosave.failure";

    if (isFailureEvent) {
      const failureAction =
        typeof event.meta.action === "string" && event.meta.action.trim()
          ? event.meta.action.trim()
          : event.event;
      inc(failuresByActionMap, failureAction);

      const errorCode =
        typeof event.meta.errorCode === "string" && event.meta.errorCode.trim()
          ? event.meta.errorCode.trim()
          : "UNKNOWN";
      inc(failuresByErrorCodeMap, errorCode);
    }
  }

  const actionsByCount = sortCountEntries(eventsByName).map((item) => ({
    event: item.key,
    count: item.count,
  }));
  const failuresByAction = sortCountEntries(failuresByActionMap).map((item) => ({
    event: item.key,
    count: item.count,
  }));
  const failuresByErrorCode = sortCountEntries(failuresByErrorCodeMap).map((item) => ({
    errorCode: item.key,
    count: item.count,
  }));

  let createdNotSent = 0;
  for (const key of created) {
    if (!pending.has(key)) {
      createdNotSent += 1;
    }
  }

  let pendingTooLong = 0;
  const pendingThresholdMs = 14 * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  for (const key of pending) {
    if (approved.has(key) || rejected.has(key)) continue;
    const pendingAt = pendingAtByKey.get(key);
    if (!pendingAt) continue;
    if (nowMs - pendingAt > pendingThresholdMs) {
      pendingTooLong += 1;
    }
  }

  let uploadStartedWithoutCommit = 0;
  for (const key of uploadStarted) {
    if (!committed.has(key) && !pending.has(key) && !approved.has(key)) {
      uploadStartedWithoutCommit += 1;
    }
  }

  const recentFailures = eventsDesc
    .filter(
      (event) =>
        event.success === false ||
        event.event === "action.failure" ||
        event.event === "validation.failure" ||
        event.event === "rate_limit.hit" ||
        event.event === "payload.too_large" ||
        event.event === "upload.failure" ||
        event.event === "autosave.failure"
    )
    .slice(0, 25);

  return {
    generatedAt: nowISO,
    totalEvents: events.length,
    eventsByName,
    usageByCategory,
    actionsByCount,
    failuresByAction,
    failuresByErrorCode,
    funnel: {
      created: created.size,
      pending: pending.size,
      approved: approved.size,
      rejected: rejected.size,
    },
    dropOff: {
      createdNotSent,
      pendingTooLong,
      uploadStartedWithoutCommit,
    },
    turnaround: {
      draftToPendingAvgMs:
        draftToPendingSamples > 0 ? Math.round(draftToPendingTotal / draftToPendingSamples) : null,
      draftToPendingSamples,
      pendingToApprovedAvgMs:
        pendingToApprovedSamples > 0
          ? Math.round(pendingToApprovedTotal / pendingToApprovedSamples)
          : null,
      pendingToApprovedSamples,
    },
    recentFailures,
    recentEvents: eventsDesc.slice(0, 100),
  };
}

