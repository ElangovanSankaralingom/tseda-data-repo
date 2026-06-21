"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Plus, ArrowLeft, FileText, Clock } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useTiltEffect } from "@/hooks/useTiltEffect";
import EntryShell from "@/components/entry/EntryShell";
import SectionCard from "@/components/layout/SectionCard";
import PhaseProgressIndicator from "@/components/data-entry/PhaseProgressIndicator";
import { EditorStatusBanners } from "@/components/data-entry/EditorStatusBanner";
import EditorMetadataFooter from "@/components/data-entry/EditorMetadataFooter";
import { computeFieldProgress } from "@/lib/entries/fieldProgress";
import { getIncompleteFields } from "@/lib/entries/incompleteFields";
import type { EditTimeRemaining } from "@/lib/entries/workflow";
import { getCategoryConfig, type CategorySlug } from "@/data/categoryRegistry";
import { getCategoryIcon } from "@/lib/ui/categoryIcons";
import { dashboard } from "@/lib/entryNavigation";
import { type CardContent, type ListStats } from "./dataEntryTypes";

/*
  ─────────────────────────────────────────────────────────
   CATEGORY PAGE HERO — LAYERED SURFACE SYSTEM

   NOT a flat glass panel. This hero has DEPTH:

   L0: Page background
   L1: Hero card (dark, accent-tinted)
       ┃ Left accent ribbon (thick gradient)
       ┃ [icon]  Category Title           [count]
       ┃         Subtitle
       ┃
       ┃  L2: BRIGHT stat panel (accent-tinted surface)
       ┃  ┌───────────────────────────────────────────┐
       ┃  │ ┌─dark─┐ ┌─dark─┐ ┌─dark──┐ ┌─dark────┐  │
       ┃  │ │3 DRF │ │4 ACT │ │2 PEND │ │8 DONE   │  │
       ┃  │ └──────┘ └──────┘ └───────┘ └─────────┘  │
       ┃  │ ▓▓▓▓▓░░░░░░░░ distribution bar            │
       ┃  └───────────────────────────────────────────┘
       ┃
       ┃  [+ New Entry]
  ─────────────────────────────────────────────────────────
*/

type CategoryEntryPageShellProps = {
  entryShell: Omit<React.ComponentProps<typeof EntryShell>, "children">;
  loading: boolean;
  loadingMessage?: React.ReactNode;
  showForm: boolean;
  topContent?: React.ReactNode;
  formCard?: CardContent | null;
  listCard?: CardContent | null;
  confirmationDialog?: React.ReactNode;
  onAddEntry?: () => void;
  addEntryLabel?: string;
  onRequestEdit?: () => void;
  onCancelRequestEdit?: () => void;
  onCancelRequestDelete?: () => void;
};

function LoadingState({ message }: { message: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-6 text-sm"
      style={{
        color: "var(--color-text-tertiary)",
        background: "var(--color-surface-inset-deep)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      {message}
    </div>
  );
}

/* ═══ CATEGORY HERO — LAYERED WITH DASHBOARD DNA ═══ */
function CategoryHero({
  category,
  title,
  subtitle,
  stats,
  onAdd,
  addLabel,
}: {
  category: CategorySlug;
  title?: string;
  subtitle?: string;
  stats?: ListStats;
  onAdd?: () => void;
  addLabel?: string;
}) {
  const { t } = useTranslation();
  const config = getCategoryConfig(category);
  const chartHex = config.color.chartHex;
  const Icon = useMemo(() => getCategoryIcon(config.icon), [config.icon]);
  const { ref: tiltRef, style: tiltStyle, lightStyle, handlers } = useTiltEffect();
  const completionPct = stats && stats.total > 0 ? Math.round((stats.finalized / stats.total) * 100) : 0;

  return (
    <div className="mb-6 animate-fade-in-up">
      {/* ═══ OUTER CONTAINER — dashboard DNA: rich gradient + holographic tilt ═══ */}
      <div
        ref={tiltRef}
        className="relative overflow-hidden rounded-3xl"
        style={{
          ...tiltStyle,
          background: `linear-gradient(135deg, ${chartHex} 0%, color-mix(in srgb, white 14%, ${chartHex}) 100%)`,
          border: `1px solid var(--color-surface-on-accent)`,
          boxShadow: `0 1px 2px rgba(20,30,70,0.05), 0 12px 28px -22px ${chartHex}33`,
        }}
        {...handlers}
      >
        {/* ── Specular light reflection (holographic tilt) ── */}
        <div style={lightStyle} />

        {/* ── Brass top rule — matches the dashboard hero band ── */}
        <div
          className="h-[3px] animate-bar-draw origin-center"
          style={{ background: "var(--color-status-warning)" }}
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
          className="absolute -right-6 -bottom-6 pointer-events-none select-none"
          style={{ opacity: 0.1 }}
        >
          {/* eslint-disable-next-line react-hooks/static-components */}
          <Icon className="size-48" style={{ color: "var(--color-text-on-accent)" }} />
        </div>

        <div className="relative p-6 sm:p-8">
          {/* Back link + divider — white on the band */}
          {/* Top row: back link + divider + New entry */}
          <div className="mb-6 flex items-center gap-3.5">
            <Link
              href={dashboard()}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-text-on-accent-muted)] transition-colors hover:text-[var(--color-text-on-accent)]"
            >
              <ArrowLeft className="size-[15px]" />
              {t("nav.dashboard")}
            </Link>
            <div className="h-px flex-1" style={{ background: "var(--color-surface-on-accent)" }} />
            {onAdd && (
              <button
                type="button"
                onClick={onAdd}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 hover:-translate-y-0.5"
                style={{ background: "var(--color-card-bg)", color: chartHex, boxShadow: "0 3px 10px -8px rgba(10,16,42,0.18)" }}
              >
                <Plus className="size-4" />
                {addLabel || t('entry.newEntry')}
              </button>
            )}
          </div>

          {/* Main: identity + completion gauge (left) · counter panel (right) */}
          <div className="flex flex-wrap items-stretch gap-5">
            <div className="flex min-w-[264px] flex-1 flex-col justify-between gap-5">
              <div>
                <div className="flex items-center gap-3.5">
                  <div
                    className="flex size-[54px] shrink-0 items-center justify-center rounded-2xl"
                    style={{ background: "var(--color-surface-on-accent)", border: "1px solid var(--color-surface-on-accent-strong)" }}
                  >
                    {/* eslint-disable-next-line react-hooks/static-components */}
                    <Icon className="size-7" style={{ color: "var(--color-text-on-accent)" }} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: "var(--color-text-on-accent-muted)" }}>
                      {t('entry.categoryWorkspace')}
                    </span>
                    <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.025em] text-[var(--color-text-on-accent)] sm:text-[30px]">{title || "Entries"}</h1>
                  </div>
                </div>
                {subtitle ? (
                  <p className="mt-3 max-w-md text-sm leading-relaxed" style={{ color: "var(--color-text-on-accent-muted)" }}>{subtitle}</p>
                ) : null}
              </div>

              {/* Completion gauge chip */}
              {stats && stats.total > 0 && (
                <div
                  className="inline-flex items-center gap-3.5 self-start rounded-2xl px-4 py-3"
                  style={{ background: "var(--color-surface-on-accent)", border: "1px solid var(--color-surface-on-accent-strong)", backdropFilter: "blur(8px)" }}
                >
                  <div
                    className="relative shrink-0 rounded-full"
                    style={{ width: "52px", height: "52px", background: `conic-gradient(var(--color-status-warning) 0% ${completionPct}%, var(--color-surface-on-accent-strong) ${completionPct}% 100%)` }}
                  >
                    <div
                      className="absolute inset-[6px] flex items-center justify-center rounded-full"
                      style={{ background: `color-mix(in srgb, ${chartHex} 88%, white)` }}
                    >
                      <span className="font-mono text-[13px] font-extrabold" style={{ color: "var(--color-text-on-accent)" }}>{completionPct}%</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[13px] font-bold" style={{ color: "var(--color-text-on-accent)" }}>{t('entry.completion')}</div>
                    <div className="mt-0.5 text-xs font-medium tabular-nums" style={{ color: "var(--color-text-on-accent-muted)" }}>
                      {stats.finalized}/{stats.total} {t('common.finalized').toLowerCase()}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Counter panel — grey card, white/amber mini-stats */}
            {stats && stats.total > 0 && (
              <div className="flex w-full shrink-0 sm:w-[280px]">
                <div
                  className="flex flex-1 flex-col overflow-hidden rounded-[18px]"
                  style={{ background: "var(--color-surface-inset)", border: "1px solid var(--color-border-default)", boxShadow: "0 8px 18px -14px rgba(10,16,42,0.20)" }}
                >
                  <div className="h-[2px]" style={{ background: chartHex, opacity: 0.5 }} />
                  <div className="flex flex-1 flex-col gap-4 p-5">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: "var(--color-text-secondary)" }}>
                        {t('dashboard.totalEntries')}
                      </div>
                      <div className="mt-1 font-mono text-[38px] font-extrabold leading-none tracking-tight tabular-nums" style={{ color: "var(--color-text-primary)" }}>
                        {stats.total}
                      </div>
                    </div>
                    <div className="flex gap-2.5">
                      <div className="flex-1 rounded-xl px-3 py-2.5" style={{ background: "var(--color-card-bg)", border: "1px solid var(--color-border-subtle)" }}>
                        <div className="flex items-center gap-1.5">
                          <FileText className="size-[15px]" style={{ color: "var(--color-text-placeholder)" }} />
                          <span className="font-mono text-[17px] font-extrabold tabular-nums" style={{ color: "var(--color-text-primary)" }}>{stats.drafts}</span>
                        </div>
                        <div className="mt-0.5 text-[11px] font-semibold" style={{ color: "var(--color-text-muted)" }}>{t('common.drafts')}</div>
                      </div>
                      <div className="flex-1 rounded-xl px-3 py-2.5" style={{ background: "var(--color-status-warning-bg)", border: "1px solid var(--color-status-warning-border)" }}>
                        <div className="flex items-center gap-1.5">
                          <Clock className="size-[15px]" style={{ color: "var(--color-palette-orange-fg)" }} />
                          <span className="font-mono text-[17px] font-extrabold tabular-nums" style={{ color: "var(--color-palette-orange-fg)" }}>{stats.pending}</span>
                        </div>
                        <div className="mt-0.5 text-[11px] font-semibold" style={{ color: "var(--color-palette-orange-fg)" }}>{t('common.pending')}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Console strip */}
          {stats && stats.total > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-3.5 rounded-xl px-4 py-2.5" style={{ background: "var(--color-surface-on-accent)", border: "1px solid var(--color-surface-on-accent-strong)" }}>
              <span className="font-mono text-[11px] font-semibold tracking-wide" style={{ color: "var(--color-text-on-accent-muted)" }}>
                {`> ${category.toUpperCase().replace(/-/g, ".")}`}
              </span>
              <span className="size-1.5 rounded-full" style={{ background: "var(--color-status-success)", boxShadow: "0 0 8px color-mix(in srgb, var(--color-status-success) 60%, transparent)" }} />
              <ConsoleStat value={stats.total} label={t('dashboard.entries')} />
              <ConsoleDivider />
              <ConsoleStat value={stats.finalized} label={t('common.finalized')} />
              {stats.streakActive > 0 && (
                <>
                  <ConsoleDivider />
                  <ConsoleStat value={stats.streakActive} label={t('entry.streaks')} />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConsoleStat({ value, label }: { value: number; label: string }) {
  return (
    <span className="font-mono text-[11px] font-medium uppercase tracking-wide tabular-nums" style={{ color: "var(--color-text-on-accent-muted)" }}>
      {value} {label}
    </span>
  );
}

function ConsoleDivider() {
  return <span className="h-3 w-px" style={{ background: "var(--color-surface-on-accent-strong)" }} />;
}

/* ═══ EMPTY STATE ═══ */
function CategoryEmptyState({
  category,
}: {
  category: CategorySlug;
  onAdd?: () => void;
  addLabel?: string;
}) {
  const { t } = useTranslation();
  const config = getCategoryConfig(category);
  const chartHex = config.color.chartHex;
  const Icon = useMemo(() => getCategoryIcon(config.icon), [config.icon]);

  return (
    <div className="relative mt-2 animate-fade-in-up stagger-2">
      {/* Ambient glow behind the card */}
      <div
        className="absolute inset-0 -z-10 rounded-3xl blur-3xl opacity-[0.04]"
        style={{ background: `radial-gradient(ellipse at center, ${chartHex}, transparent 70%)` }}
      />

      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          background: "linear-gradient(165deg, var(--color-surface-raised) 0%, var(--color-body-bg) 100%)",
          border: "1px solid var(--color-border-subtle)",
          boxShadow: "0 1px 3px rgba(30,40,90,0.05), inset 0 1px 0 var(--color-border-subtle)",
        }}
      >
        {/* Subtle grid pattern overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle, ${chartHex} 0.5px, transparent 0.5px)`,
            backgroundSize: "20px 20px",
          }}
        />

        {/* Content */}
        <div className="relative flex flex-col items-center py-16 px-8">
          {/* Icon with layered glow */}
          <div className="relative">
            <div
              className="absolute inset-0 rounded-2xl blur-xl opacity-20"
              style={{ background: chartHex }}
            />
            <div
              className="relative flex size-16 items-center justify-center rounded-2xl"
              style={{
                background: `linear-gradient(145deg, ${chartHex}15 0%, ${chartHex}08 100%)`,
                border: `1px solid ${chartHex}20`,
              }}
            >
              {/* eslint-disable-next-line react-hooks/static-components */}
              <Icon className="size-7" style={{ color: `${chartHex}90` }} />
            </div>
          </div>

          {/* Text */}
          <p className="mt-6 text-[13px] font-semibold" style={{ color: "var(--color-text-secondary)" }}>
            {t('entry.noEntries')}
          </p>
          <p className="mt-1.5 text-[12px] max-w-[260px]" style={{ color: "var(--color-text-tertiary)" }}>
            {t('entry.createFirstEntry')}
          </p>

          {/* Decorative accent line */}
          <div
            className="mt-8 h-[1.5px] w-16 rounded-full"
            style={{
              background: `linear-gradient(90deg, transparent, ${chartHex}40, transparent)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ═══ PAGE BACKGROUND — BLUE-TINTED WITH GRID + SCANLINE ═══ */
function PageBackground({ chartHex, children }: { chartHex: string; children: React.ReactNode }) {
  return (
    <div className="relative min-h-[80vh]">
      {/* Soft radial accent glow at top — dots come from global body bg */}
      <div
        className="absolute inset-0 pointer-events-none rounded-3xl"
        style={{
          background: `radial-gradient(ellipse 60% 30% at 50% -5%, ${chartHex}08, transparent)`,
        }}
      />
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

/* ═══ MAIN SHELL ═══ */
export default function CategoryEntryPageShell({
  entryShell,
  loading,
  loadingMessage,
  showForm,
  topContent,
  formCard,
  listCard,
  confirmationDialog,
  onAddEntry,
  addEntryLabel,
  onCancelRequestEdit,
  onCancelRequestDelete,
}: CategoryEntryPageShellProps) {
  const { t } = useTranslation();
  const resolvedLoadingMessage = loadingMessage ?? t('common.loading');

  // Form mode
  if (showForm) {
    const entry = entryShell.entry as Record<string, unknown> | null;
    const category = entryShell.category;
    const isGenerated = !!entry?.committedAtISO;
    const progress = computeFieldProgress(category, entry, isGenerated);
    const incomplete = getIncompleteFields(category, entry, isGenerated);
    const streakEligible = !!entry?.streakEligible;
    const editable = entry?.isEditable !== false;
    const editTime = (entry?.editTimeRemaining as EditTimeRemaining | undefined) ?? null;
    const status = typeof entry?.confirmationStatus === "string" ? entry.confirmationStatus : null;
    const isNewDraft = !entry?.id || (!isGenerated && status !== "EDIT_REQUESTED" && status !== "DELETE_REQUESTED" && status !== "EDIT_GRANTED" && status !== "ARCHIVED");

    return (
      <EntryShell {...entryShell}>
        <div className="space-y-4">
          {!isNewDraft || (status && status !== "DRAFT") ? (
            <EditorStatusBanners
              status={status}
              isEditable={editable}
              editTimeLabel={editTime?.hasEditWindow && !editTime.expired ? editTime.remainingLabel : undefined}
              editTimeMs={editTime?.remainingMs}
              expiresAtISO={editTime?.expiresAtISO}
              hasPdf={!!entry?.pdfMeta}
              permanentlyLocked={entry?.permanentlyLocked === true}
              onCancelRequest={onCancelRequestEdit}
              onCancelRequestDelete={onCancelRequestDelete}
            />
          ) : null}

          {topContent}

          {loading ? <LoadingState message={resolvedLoadingMessage} /> : null}

          {!loading && formCard ? (
            <SectionCard className={formCard.className} title={formCard.title} subtitle={formCard.subtitle}>
              {editable ? (
                <PhaseProgressIndicator
                  category={category}
                  stage1={{ filled: progress.preGenerate.completed, total: progress.preGenerate.total }}
                  stage2={{ filled: progress.postGenerate.completed, total: progress.postGenerate.total }}
                  isGenerated={isGenerated}
                  streakEligible={streakEligible}
                  missingStage1={incomplete.stage1}
                  missingStage2={incomplete.stage2}
                />
              ) : null}
              {formCard.content}
            </SectionCard>
          ) : null}

          {!loading && entry ? (
            <EditorMetadataFooter
              entryId={typeof entry.id === "string" ? entry.id : undefined}
              category={category}
              createdAt={typeof entry.createdAt === "string" ? entry.createdAt : undefined}
              updatedAt={typeof entry.updatedAt === "string" ? entry.updatedAt : undefined}
            />
          ) : null}
        </div>
        {confirmationDialog}
      </EntryShell>
    );
  }

  // List mode
  const category = entryShell.category;
  const config = getCategoryConfig(category);
  const chartHex = config.color.chartHex;
  const stats = listCard?.stats;
  const hasEntries = stats ? stats.total > 0 : false;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageBackground chartHex={chartHex}>
        <div className="px-1 pt-1 pb-8">
          <CategoryHero
            category={category}
            subtitle={entryShell.subtitle}
            stats={stats}
            onAdd={onAddEntry}
            addLabel={addEntryLabel}
          />

          {topContent}

          {loading ? <LoadingState message={resolvedLoadingMessage} /> : null}

          {!loading && listCard && hasEntries ? (
            <div className="animate-fade-in-up stagger-1">
              {listCard.content}
            </div>
          ) : null}

          {!loading && !hasEntries ? (
            <CategoryEmptyState
              category={category}
              onAdd={onAddEntry}
              addLabel={addEntryLabel}
            />
          ) : null}
        </div>
      </PageBackground>

      {confirmationDialog}
    </div>
  );
}
