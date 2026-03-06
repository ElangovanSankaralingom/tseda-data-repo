"use client";

import BackTo from "@/components/nav/BackTo";
import EntryStatusBadge from "@/components/entry/EntryStatusBadge";
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
  const entryId = String(entry?.id ?? "").trim();
  const entryTitle = entry ? getCategoryTitle(entry, category) : "";
  const resolvedTitle = title?.trim() || entryTitle || getModeTitle(mode);
  const resolvedSubtitle = subtitle ?? config.subtitle ?? "";
  const statusValue =
    status ??
    (typeof entry?.confirmationStatus === "string" ? entry.confirmationStatus : null);
  const resolvedStatus = statusValue ? normalizeEntryApprovalStatus(statusValue) : null;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="rounded-2xl border border-border bg-card px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {showBack ? (
              <BackTo href={backHref} disabled={backDisabled} compact onClick={onBack} />
            ) : null}
            <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {config.label}
            </span>
            {resolvedStatus ? <EntryStatusBadge status={resolvedStatus} /> : null}
            {showUnsavedChanges ? (
              <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                {unsavedLabel}
              </span>
            ) : null}
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">{resolvedTitle}</h1>
          {entryId ? (
            <p className="mt-1 text-xs text-muted-foreground">Entry ID: {entryId}</p>
          ) : null}
          {resolvedSubtitle ? <p className="mt-2 text-sm text-muted-foreground">{resolvedSubtitle}</p> : null}
          {meta ? <div className="mt-2">{meta}</div> : null}
        </div>

        {actions ? (
          <div className={cx("mt-4 flex flex-wrap items-center justify-end gap-2", !showBack && "justify-start")}>
            {actions}
          </div>
        ) : null}
      </div>

      {children}
    </div>
  );
}
