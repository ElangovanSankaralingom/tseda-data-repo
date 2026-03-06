"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeError } from "@/lib/errors";
import type { Result } from "@/lib/result";
import { trackClientTelemetryEvent } from "@/lib/telemetry/client";

type Primitive = string | number | boolean | null | undefined;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value as Primitive);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort((left, right) => left.localeCompare(right))
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function getTelemetryContext(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { entryId: null as string | null, status: null as string | null };
  }
  const record = value as Record<string, unknown>;
  const entryId =
    typeof record.id === "string" && record.id.trim() ? record.id.trim() : null;
  const status =
    typeof record.confirmationStatus === "string" && record.confirmationStatus.trim()
      ? record.confirmationStatus.trim()
      : typeof record.status === "string" && record.status.trim()
        ? record.status.trim()
        : null;
  return { entryId, status };
}

export type AutoSavePhase = "idle" | "saving" | "saved" | "error";

export type AutoSaveStatus = {
  phase: AutoSavePhase;
  savedAtISO: string | null;
  errorMessage: string | null;
};

type UseAutoSaveOptions<T> = {
  enabled: boolean;
  value: T;
  onSave: (value: T) => Promise<Result<T> | null>;
  debounceMs?: number;
  onStatusChange?: (status: AutoSaveStatus) => void;
};

type UseAutoSaveResult<T> = {
  status: AutoSaveStatus;
  flush: () => Promise<Result<T> | null>;
  cancel: () => void;
  markSaved: (value?: T) => void;
};

function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

export function useAutoSave<T>({
  enabled,
  value,
  onSave,
  debounceMs = 15000,
  onStatusChange,
}: UseAutoSaveOptions<T>): UseAutoSaveResult<T> {
  const valueRef = useLatestRef(value);
  const onSaveRef = useLatestRef(onSave);
  const onStatusChangeRef = useLatestRef(onStatusChange);
  const enabledRef = useLatestRef(enabled);

  const currentHash = useMemo(() => stableStringify(value), [value]);
  const currentHashRef = useLatestRef(currentHash);
  const lastSavedHashRef = useRef(currentHash);
  const lastAttemptedHashRef = useRef(currentHash);
  const savingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status, setStatus] = useState<AutoSaveStatus>({
    phase: "idle",
    savedAtISO: null,
    errorMessage: null,
  });

  const pushStatus = useCallback((next: AutoSaveStatus) => {
    setStatus(next);
    onStatusChangeRef.current?.(next);
  }, [onStatusChangeRef]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const markSaved = useCallback(
    (nextValue?: T) => {
      clearTimer();
      const hash = stableStringify(nextValue ?? valueRef.current);
      lastSavedHashRef.current = hash;
      lastAttemptedHashRef.current = hash;
      pushStatus({
        phase: "saved",
        savedAtISO: new Date().toISOString(),
        errorMessage: null,
      });
    },
    [clearTimer, pushStatus, valueRef]
  );

  const runSave = useCallback(
    async (force: boolean): Promise<Result<T> | null> => {
      const hash = currentHashRef.current;
      if (!force) {
        if (!enabledRef.current) return null;
        if (hash === lastSavedHashRef.current || hash === lastAttemptedHashRef.current) {
          return null;
        }
      } else if (!enabledRef.current && hash === lastSavedHashRef.current) {
        return null;
      }

      if (savingRef.current) return null;

      savingRef.current = true;
      lastAttemptedHashRef.current = hash;
      const startedAt = Date.now();
      pushStatus({
        phase: "saving",
        savedAtISO: status.savedAtISO,
        errorMessage: null,
      });

      try {
        const result = await onSaveRef.current(valueRef.current);
        if (!result) {
          pushStatus({
            phase: "idle",
            savedAtISO: status.savedAtISO,
            errorMessage: null,
          });
          return null;
        }

        if (result.ok) {
          const nextHash = stableStringify(result.data ?? valueRef.current);
          lastSavedHashRef.current = nextHash;
          lastAttemptedHashRef.current = nextHash;
          const telemetry = getTelemetryContext(valueRef.current);
          void trackClientTelemetryEvent({
            event: "autosave.success",
            entryId: telemetry.entryId,
            status: telemetry.status,
            success: true,
            durationMs: Date.now() - startedAt,
            meta: {
              source: "autosave",
            },
          });
          pushStatus({
            phase: "saved",
            savedAtISO: new Date().toISOString(),
            errorMessage: null,
          });
          return result;
        }

        pushStatus({
          phase: "error",
          savedAtISO: status.savedAtISO,
          errorMessage: result.error.message || "Autosave failed.",
        });
        const telemetry = getTelemetryContext(valueRef.current);
        void trackClientTelemetryEvent({
          event: "autosave.failure",
          entryId: telemetry.entryId,
          status: telemetry.status,
          success: false,
          durationMs: Date.now() - startedAt,
          meta: {
            source: "autosave",
            errorCode: result.error.code,
          },
        });
        return result;
      } catch (error) {
        const normalized = normalizeError(error);
        const telemetry = getTelemetryContext(valueRef.current);
        void trackClientTelemetryEvent({
          event: "autosave.failure",
          entryId: telemetry.entryId,
          status: telemetry.status,
          success: false,
          durationMs: Date.now() - startedAt,
          meta: {
            source: "autosave",
            errorCode: normalized.code,
          },
        });
        pushStatus({
          phase: "error",
          savedAtISO: status.savedAtISO,
          errorMessage: normalized.message || "Autosave failed.",
        });
        return { ok: false, error: normalized };
      } finally {
        savingRef.current = false;
      }
    },
    [currentHashRef, enabledRef, onSaveRef, pushStatus, status.savedAtISO, valueRef]
  );

  const flush = useCallback(async () => {
    clearTimer();
    return runSave(true);
  }, [clearTimer, runSave]);

  const cancel = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  useEffect(() => {
    clearTimer();

    if (!enabled) {
      if (status.phase !== "saved") {
        pushStatus({
          phase: "idle",
          savedAtISO: status.savedAtISO,
          errorMessage: null,
        });
      }
      return;
    }

    if (currentHash === lastSavedHashRef.current || currentHash === lastAttemptedHashRef.current) {
      return;
    }

    timerRef.current = setTimeout(() => {
      void runSave(false);
    }, debounceMs);

    return () => clearTimer();
  }, [clearTimer, currentHash, debounceMs, enabled, pushStatus, runSave, status.phase, status.savedAtISO]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return {
    status,
    flush,
    cancel,
    markSaved,
  };
}
