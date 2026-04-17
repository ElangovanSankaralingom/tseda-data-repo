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
            background: `linear-gradient(135deg, rgba(0,0,0,0.45) 0%, ${chartHex}12 50%, rgba(0,0,0,0.4) 100%)`,
            border: "1px solid var(--color-divider)",
            boxShadow: `0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 var(--color-border-subtle)`,
          }}
          {...handlers}
        >
          {/* Specular light reflection */}
          <div style={lightStyle} />

          {/* Top accent bar — category colored, animated */}
          <div
            className="h-[3px] animate-bar-draw origin-center"
            style={{
              background: chartHex,
              boxShadow: `0 1px 8px ${chartHex}25`,
            }}
          />

          {/* Color bleed gradient */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(135deg, ${chartHex}10 0%, transparent 40%)`,
              borderRadius: "inherit",
            }}
          />

          {/* Category watermark — large faint icon */}
          <div
            className="absolute -right-4 -bottom-4 pointer-events-none select-none"
            style={{ opacity: 0.04 }}
          >
            {/* eslint-disable-next-line react-hooks/static-components */}
            <Icon className="size-36" style={{ color: chartHex }} />
          </div>

          {/* HUD corner coordinates */}
          <div
            className="absolute top-3 right-4 font-mono text-[9px] tracking-wider select-none pointer-events-none"
            style={{ color: "var(--color-text-placeholder)" }}
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
                    color: chartHex,
                    background: `${chartHex}15`,
                    border: `1px solid ${chartHex}25`,
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
                  background: `${chartHex}18`,
                  border: `1px solid ${chartHex}30`,
                  boxShadow: `0 0 20px ${chartHex}12`,
                }}
              >
                {/* eslint-disable-next-line react-hooks/static-components */}
                <Icon className="size-6 sm:size-7" style={{ color: chartHex }} />
              </div>
              <div className="min-w-0">
                <h1
                  className="text-xl font-bold tracking-tight sm:text-2xl"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {resolvedTitle}
                </h1>
                {resolvedSubtitle ? (
                  <p
                    className="mt-0.5 max-w-md text-sm line-clamp-2"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    {resolvedSubtitle}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Status row — inset panel */}
            {showStatusRow ? (
              <div
                className="mt-4 flex flex-wrap items-center gap-2.5 rounded-xl px-3.5 py-2.5"
                style={{
                  background: "linear-gradient(90deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.2) 100%)",
                  border: "1px solid var(--color-border-subtle)",
                  boxShadow: "inset 0 1px 3px rgba(0,0,0,0.2)",
                }}
              >
                <StatusBadge status={resolvedStatus ?? "DRAFT"} />
                {meta ? <div className="flex items-center">{meta}</div> : null}
                {showUnsavedChanges ? (
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      color: "#fbbf24",
                      background: "rgba(251,191,36,0.1)",
                      border: "1px solid rgba(251,191,36,0.25)",
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
        <div className="sticky top-0 z-40 mb-4 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)]/80 px-4 py-3 shadow-sm backdrop-blur-xl sm:px-5">
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
