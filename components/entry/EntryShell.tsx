"use client";

import { useMemo } from "react";
import BackTo from "@/components/nav/BackTo";
import StatusBadge from "@/components/ui/StatusBadge";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useTiltEffect } from "@/hooks/useTiltEffect";

import {
  getCategoryConfig,
  getCategoryTitle,
  type CategorySlug,
} from "@/data/categoryRegistry";
import { getCategoryIcon } from "@/lib/ui/categoryIcons";
import { normalizeEntryApprovalStatus } from "@/lib/confirmation";
import { type EntryShellMode } from "@/lib/types/ui";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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
  const { t } = useTranslation();
  const config = getCategoryConfig(category);
  const chartHex = config.color.chartHex;
  const Icon = useMemo(() => getCategoryIcon(config.icon), [config.icon]);
  const entryTitle = entry ? getCategoryTitle(entry, category) : "";
  const modeTitle = mode === "new" ? t('entry.newEntry') : mode === "edit" ? t('entry.editEntry') : mode === "view" ? "View Entry" : "Entries";
  const resolvedTitle = title?.trim() || entryTitle || modeTitle;
  const resolvedSubtitle = subtitle ?? config.subtitle ?? "";
  const statusValue =
    status ??
    (typeof entry?.confirmationStatus === "string" ? entry.confirmationStatus : null);
  const resolvedStatus = statusValue ? normalizeEntryApprovalStatus(statusValue) : null;
  const showStatusRow = Boolean(resolvedStatus) || Boolean(meta) || showUnsavedChanges;
  const isEditingMode = mode === "new" || mode === "edit";
  const { ref: tiltRef, style: tiltStyle, lightStyle, handlers } = useTiltEffect();

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* ═══ PREMIUM HEADER — CategoryHero DNA ═══ */}
      <div className="mb-4 animate-fade-in-up">
        <div
          ref={tiltRef}
          className="relative overflow-hidden rounded-3xl"
          style={{
            ...tiltStyle,
            background: `linear-gradient(135deg, ${chartHex} 0%, color-mix(in srgb, white 14%, ${chartHex}) 100%)`,
            border: "1px solid var(--color-surface-on-accent)",
            boxShadow: `0 1px 2px rgba(20,30,70,0.05), 0 12px 28px -22px ${chartHex}33`,
          }}
          {...handlers}
        >
          {/* Specular light reflection */}
          <div style={lightStyle} />

          {/* Universal white top rule — reads on every category accent */}
          <div
            className="h-[3px] animate-bar-draw origin-center"
            style={{ background: "var(--color-text-on-accent)" }}
          />

          {/* Specular sheen — top-left highlight on the band */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(120% 80% at 6% -12%, var(--color-surface-on-accent), transparent 55%)`,
              borderRadius: "inherit",
            }}
          />

          {/* Category watermark — large faint white icon */}
          <div
            className="absolute -right-5 -bottom-5 pointer-events-none select-none"
            style={{ opacity: 0.1 }}
          >
            {/* eslint-disable-next-line react-hooks/static-components */}
            <Icon className="size-40" style={{ color: "var(--color-text-on-accent)" }} />
          </div>

          {/* HUD corner coordinates */}
          <div
            className="absolute top-3 right-4 font-mono text-[9px] tracking-wider select-none pointer-events-none"
            style={{ color: "var(--color-text-on-accent-muted)" }}
          >
            [{category.toUpperCase().replace(/-/g, ".")}]
          </div>

          <div className="relative px-5 pt-4 pb-5 sm:px-7 sm:pt-5 sm:pb-6">
            {/* Back + mode pill row */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {showBack ? (
                <BackTo href={backHref} disabled={backDisabled} onClick={onBack} />
              ) : null}
              {mode === "view" ? (
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest"
                  style={{
                    color: "var(--color-text-on-accent)",
                    background: "var(--color-surface-on-accent)",
                    border: "1px solid var(--color-surface-on-accent-strong)",
                  }}
                >
                  {t('entry.viewPdf')}
                </span>
              ) : null}
            </div>

            {/* Identity row — icon pill + title */}
            <div className="flex items-center gap-3.5">
              <div
                className="flex size-12 shrink-0 items-center justify-center rounded-xl sm:size-14 sm:rounded-2xl"
                style={{
                  background: "var(--color-surface-on-accent)",
                  border: "1px solid var(--color-surface-on-accent-strong)",
                }}
              >
                {/* eslint-disable-next-line react-hooks/static-components */}
                <Icon className="size-6 sm:size-7" style={{ color: "var(--color-text-on-accent)" }} />
              </div>
              <div className="min-w-0">
                <h1
                  className="text-xl font-bold tracking-tight sm:text-2xl"
                  style={{ color: "var(--color-text-on-accent)" }}
                >
                  {resolvedTitle}
                </h1>
                {resolvedSubtitle ? (
                  <p
                    className="mt-0.5 max-w-md text-sm line-clamp-2"
                    style={{ color: "var(--color-text-on-accent-muted)" }}
                  >
                    {resolvedSubtitle}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Status row — light inset card sitting on the band */}
            {showStatusRow ? (
              <div
                className="mt-4 flex flex-wrap items-center gap-2.5 rounded-xl px-3.5 py-2.5"
                style={{
                  background: "var(--color-surface-inset)",
                  border: "1px solid var(--color-border-default)",
                  boxShadow: "0 8px 18px -14px rgba(10,16,42,0.20)",
                }}
              >
                <StatusBadge status={resolvedStatus ?? "DRAFT"} />
                {meta ? <div className="flex items-center">{meta}</div> : null}
                {showUnsavedChanges ? (
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      color: "var(--color-status-warning)",
                      background: "var(--color-status-warning-bg)",
                      border: "1px solid var(--color-status-warning-border)",
                    }}
                  >
                    {unsavedLabel}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Sticky action bar for editing */}
      {isEditingMode && actions ? (
        <div
          className="sticky top-0 z-40 mb-4 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-card-bg)] px-4 py-3 sm:px-5"
          style={{ boxShadow: "0 1px 2px rgba(20,30,70,0.04), 0 6px 16px -12px rgba(30,40,90,0.10)" }}
        >
          {actions}
        </div>
      ) : null}

      {/* Non-editing actions */}
      {!isEditingMode && actions ? (
        <div className={cx("mb-4 flex flex-wrap items-center justify-end gap-2 px-1", !showBack && "justify-start")}>
          {actions}
        </div>
      ) : null}

      <div>{children}</div>
    </div>
  );
}
