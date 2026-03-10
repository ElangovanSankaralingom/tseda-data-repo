"use client";

/**
 * Sub-hook: generate entry (PDF) and finalise entry operations.
 */
import {
  useCallback,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import {
  runGenerateEntryOrchestration,
} from "@/lib/entries/pageOrchestration";
import type { CategoryKey } from "@/lib/entries/types";
import type { CategoryPageEntry, GenerateEntrySnapshot, ToastState } from "@/hooks/controllerTypes";

type UseEntryGenerateAndFinaliseOptions<TEntry extends CategoryPageEntry> = {
  category: CategoryKey;
  saveLockRef: MutableRefObject<boolean>;
  setSaving: Dispatch<SetStateAction<boolean>>;
  setToast: Dispatch<SetStateAction<ToastState | null>>;
  setList: Dispatch<SetStateAction<TEntry[]>>;
  showToast: (type: ToastState["type"], msg: string, durationMs?: number) => void;
  hasBusyUploads: boolean;
  hasValidationErrors: boolean;
  canGenerate: boolean;
  persistEntry: (entry: TEntry) => Promise<TEntry>;
  markGenerateAttempted: () => void;
  beforeGenerate?: () => void;
  afterGenerate?: () => void;
  buildDraftEntry: () => TEntry;
  generateEntrySnapshot: GenerateEntrySnapshot<TEntry>;
  applyGeneratedEntry: (entry: TEntry) => void | Promise<void>;
  generateValidationMessage: string;
  generateBusyMessage: string;
  generateSuccessMessage: string;
  generateErrorMessage: string;
};

export function useEntryGenerateAndFinalise<TEntry extends CategoryPageEntry>(
  options: UseEntryGenerateAndFinaliseOptions<TEntry>,
) {
  const nextRouter = useRouter();
  const [finalisingIds, setFinalisingIds] = useState<Record<string, boolean>>({});

  const generateEntry = useCallback(async (): Promise<boolean> => {
    const success = await runGenerateEntryOrchestration<TEntry>({
      saveLockRef: options.saveLockRef,
      hasValidationErrors: options.hasValidationErrors,
      canGenerate: options.canGenerate,
      hasBusyUploads: options.hasBusyUploads,
      validationMessage: options.generateValidationMessage,
      busyMessage: options.generateBusyMessage,
      successMessage: options.generateSuccessMessage,
      errorMessage: options.generateErrorMessage,
      setSaving: options.setSaving,
      setToast: options.setToast,
      markSubmitAttempted: options.markGenerateAttempted,
      beforeGenerate: options.beforeGenerate,
      afterGenerate: options.afterGenerate,
      buildDraftEntry: options.buildDraftEntry,
      generateEntrySnapshot: options.generateEntrySnapshot,
      persistProgress: options.persistEntry,
      applyGeneratedEntry: options.applyGeneratedEntry,
    });
    nextRouter.refresh();
    return success;
  }, [
    nextRouter,
    options,
  ]);

  const finaliseEntry = useCallback(
    async (entry: TEntry): Promise<boolean> => {
      const entryId = entry.id;
      if (finalisingIds[entryId]) return false;
      setFinalisingIds((prev) => ({ ...prev, [entryId]: true }));
      try {
        const res = await fetch("/api/me/entry/finalise", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryKey: options.category, entryId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error || "Finalise failed.");
        }
        const updated = (await res.json()) as TEntry;
        options.setList((prev) => prev.map((e) => (e.id === entryId ? updated : e)));
        nextRouter.refresh();
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Finalise failed.";
        options.showToast("err", message, 1800);
        return false;
      } finally {
        setFinalisingIds((prev) => ({ ...prev, [entryId]: false }));
      }
    },
    [options, finalisingIds, nextRouter],
  );

  return {
    generateEntry,
    finaliseEntry,
    finalisingIds,
  };
}
