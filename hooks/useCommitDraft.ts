"use client";

import { useCallback } from "react";
import { AppError } from "@/lib/errors";
import type { CategoryKey } from "@/lib/entries/types";

type CommitEntryLike = { id?: string | null };

export function useCommitDraft<TEntry extends CommitEntryLike>(args: {
  category: CategoryKey;
  hydrateEntry?: (entry: TEntry) => TEntry;
}) {
  const { category, hydrateEntry } = args;

  return useCallback(
    async (entryId: string) => {
      const normalizedId = String(entryId ?? "").trim();
      if (!normalizedId) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "Entry ID is required.",
        });
      }

      const response = await fetch("/api/me/entry/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryKey: category,
          entryId: normalizedId,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | TEntry
        | { error?: string; details?: Record<string, unknown> }
        | null;

      if (!response.ok) {
        const statusToCode: Record<number, AppError["code"]> = {
          400: "VALIDATION_ERROR",
          401: "UNAUTHORIZED",
          403: "FORBIDDEN",
          404: "NOT_FOUND",
        };
        throw new AppError({
          code: statusToCode[response.status] ?? "IO_ERROR",
          message:
            (payload && typeof payload === "object" && "error" in payload && payload.error) ||
            "Failed to commit draft.",
          details:
            payload && typeof payload === "object" && "details" in payload && payload.details
              ? payload.details
              : { status: response.status, category, entryId: normalizedId },
        });
      }

      const entry = (payload ?? null) as TEntry | null;
      if (!entry) {
        throw new AppError({
          code: "UNKNOWN",
          message: "Commit succeeded but response payload was empty.",
        });
      }

      return hydrateEntry ? hydrateEntry(entry) : entry;
    },
    [category, hydrateEntry]
  );
}
