"use client";

import BackTo from "@/components/nav/BackTo";
import StatusBadge from "@/components/ui/StatusBadge";

import {
  getCategoryConfig,
  getCategoryTitle,
  type CategorySlug,
} from "@/data/categoryRegistry";
import { normalizeEntryApprovalStatus } from "@/lib/confirmation";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type EntryShellMode = "new" | "edit" | "view" | "preview";

type EntryShellProps = {
  category: CategorySlug;
  mode: EntryShellMode;
  entry?: Record<string, unknown> | null;
  title?: string;
  subtitle?: string;
  status?: string | null;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  backHref: string;
  backDisabled?: boolean;
  showBack?: boolean;
  onBack?: (() => void | Promise<void>) | undefined;
  showUnsavedChanges?: boolean;
  unsavedLabel?: string;
};

function getModeTitle(mode: EntryShellMode) {
  if (mode === "new") return "New Entry";
  if (mode === "edit") return "Edit Entry";
  if (mode === "view") return "View Entry";
  return "Entries";
}

export default function EntryShell({
  category,
  mode,
  entry = null,
  title,
  subtitle,
  status,
  meta,
  actions,
  children,
  backHref,
  backDisabled = false,
  showBack = true,
  onBack,
  showUnsavedChanges = false,
  unsavedLabel = "Unsaved changes",
}: EntryShellProps) {
  const config = getCategoryConfig(category);
  const entryTitle = entry ? getCategoryTitle(entry, category) : "";
  const resolvedTitle = title?.trim() || entryTitle || getModeTitle(mode);
  const resolvedSubtitle = subtitle ?? config.subtitle ?? "";
  const statusValue =
    status ??
    (typeof entry?.confirmationStatus === "string" ? entry.confirmationStatus : null);
  const resolvedStatus = statusValue ? normalizeEntryApprovalStatus(statusValue) : null;
  const showStatusRow = Boolean(resolvedStatus) || Boolean(meta) || showUnsavedChanges;
  const isEditingMode = mode === "new" || mode === "edit";

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* Header card */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {showBack ? (
              <BackTo href={backHref} disabled={backDisabled} onClick={onBack} />
            ) : null}
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
              {config.label}
            </span>
            {mode === "view" ? (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
                Preview
              </span>
            ) : null}
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">{resolvedTitle}</h1>
          {resolvedSubtitle ? <p className="mt-2 text-sm text-slate-500">{resolvedSubtitle}</p> : null}

          {showStatusRow ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <StatusBadge status={resolvedStatus ?? "DRAFT"} />
              {meta ? <div>{meta}</div> : null}
              {showUnsavedChanges ? (
                <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                  {unsavedLabel}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {!isEditingMode && actions ? (
          <div className={cx("mt-4 flex flex-wrap items-center justify-end gap-2", !showBack && "justify-start")}>
            {actions}
          </div>
        ) : null}
      </div>

      {/* Sticky action bar for editing */}
      {isEditingMode && actions ? (
        <div className="sticky top-0 z-40 mt-4 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-xl sm:px-5">
          {actions}
        </div>
      ) : null}

      <div className="mt-6">{children}</div>
    </div>
  );
}
