"use client";

import { useMemo } from "react";
import { Plus } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useTiltEffect } from "@/hooks/useTiltEffect";
import BackTo from "@/components/nav/BackTo";
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
import CompletionRing from "./CompletionRing";

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
        background: "rgba(8,10,18,0.45)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      {message}
    </div>
  );
}

/* ── DARK MICRO-STAT PILL — colored left accent + inset feel ── */
function MicroStat({ count, label, color }: { count: number; label: string; color: string }) {
  if (count === 0) return null;
  return (
    <div
      className="relative flex items-center gap-2 overflow-hidden rounded-lg px-3.5 py-2"
      style={{
        background: "linear-gradient(90deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.35) 100%)",
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      {/* Colored left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: color }}
      />
      <span className="font-mono text-sm font-black tabular-nums" style={{ color }}>
        {count}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-placeholder)" }}>
        {label}
      </span>
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

  return (
    <div className="mb-6 animate-fade-in-up">
      {/* ═══ OUTER CONTAINER — dashboard DNA: rich gradient + holographic tilt ═══ */}
      <div
        ref={tiltRef}
        className="relative overflow-hidden rounded-3xl"
        style={{
          ...tiltStyle,
          background: `linear-gradient(135deg, rgba(0,0,0,0.45) 0%, ${chartHex}12 50%, rgba(0,0,0,0.4) 100%)`,
          border: `1px solid var(--color-divider)`,
          boxShadow: `0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 var(--color-border-subtle)`,
        }}
        {...handlers}
      >
        {/* ── Specular light reflection (holographic tilt) ── */}
        <div style={lightStyle} />

        {/* ── Top accent bar — category colored, animated like dashboard ── */}
        <div
          className="h-[3px] animate-bar-draw origin-center"
          style={{
            background: chartHex,
            boxShadow: `0 1px 8px ${chartHex}25`,
          }}
        />

        {/* Color bleed gradient — category tint */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(135deg, ${chartHex}10 0%, transparent 40%)`,
            borderRadius: "inherit",
          }}
        />

        {/* Category watermark — large faint icon */}
        <div
          className="absolute -right-6 -bottom-6 pointer-events-none select-none"
          style={{ opacity: 0.05 }}
        >
          {/* eslint-disable-next-line react-hooks/static-components */}
          <Icon className="size-48" style={{ color: chartHex }} />
        </div>

        <div className="relative p-6 sm:p-8">
          {/* Back link — same BackTo component used in form mode */}
          <div className="mb-5">
            <BackTo href={dashboard()} />
          </div>

          {/* ── HUD corner coordinates ── */}
          <div className="absolute top-3 right-4 font-mono text-[9px] tracking-wider select-none pointer-events-none" style={{ color: "var(--color-text-placeholder)" }}>
            [{category.toUpperCase().replace(/-/g, ".")}]
          </div>

          {/* Identity row — icon pill + title */}
          <div className="flex items-center gap-3.5">
            <div
              className="flex size-14 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: `${chartHex}18`,
                border: `1px solid ${chartHex}30`,
                boxShadow: `0 0 20px ${chartHex}12`,
              }}
            >
              {/* eslint-disable-next-line react-hooks/static-components */}
              <Icon className="size-7" style={{ color: chartHex }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title || "Entries"}</h1>
              {subtitle ? (
                <p className="mt-0.5 text-sm max-w-md line-clamp-2" style={{ color: "var(--color-text-tertiary)" }}>{subtitle}</p>
              ) : null}
            </div>
          </div>

          {/* ═══ L2: SUB-PANELS ROW — premium inner cards ═══ */}
          {stats && stats.total > 0 && (
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Total entries panel — hero number with category glow */}
              <div
                className="relative overflow-hidden rounded-2xl px-5 py-4"
                style={{
                  background: "linear-gradient(145deg, var(--color-surface-raised) 0%, var(--color-glass-bg) 100%)",
                  border: "1px solid var(--color-divider)",
                  boxShadow: "inset 0 1px 0 var(--color-border-subtle), 0 2px 8px rgba(0,0,0,0.15)",
                }}
              >
                {/* Subtle category color bleed in corner */}
                <div
                  className="absolute -right-4 -bottom-4 size-24 rounded-full pointer-events-none"
                  style={{ background: `radial-gradient(circle, ${chartHex}12 0%, transparent 70%)` }}
                />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "var(--color-text-tertiary)" }}>
                  {t('dashboard.totalEntries')}
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span
                    className="font-mono text-4xl font-black tracking-tighter leading-none"
                    style={{ color: chartHex, textShadow: `0 0 20px ${chartHex}30` }}
                  >
                    {stats.total}
                  </span>
                  <span className="text-xs" style={{ color: "var(--color-text-placeholder)" }}>
                    {stats.total === 1 ? t('dashboard.entry') : t('dashboard.entries')}
                  </span>
                </div>
              </div>

              {/* Completion ring panel — darker to let ring colors pop */}
              <div
                className="rounded-2xl px-4 py-3.5 hidden sm:flex items-center justify-center"
                style={{
                  background: "linear-gradient(145deg, var(--color-surface-inset) 0%, var(--color-surface-raised) 100%)",
                  border: "1px solid var(--color-border-subtle)",
                  boxShadow: "inset 0 1px 0 var(--color-border-subtle), 0 2px 8px rgba(0,0,0,0.15)",
                }}
              >
                <CompletionRing stats={stats} accentHex={chartHex} />
              </div>

              {/* Status breakdown panel */}
              <div
                className="rounded-2xl px-5 py-4"
                style={{
                  background: "linear-gradient(145deg, var(--color-surface-raised) 0%, var(--color-glass-bg) 100%)",
                  border: "1px solid var(--color-divider)",
                  boxShadow: "inset 0 1px 0 var(--color-border-subtle), 0 2px 8px rgba(0,0,0,0.15)",
                }}
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "var(--color-text-tertiary)" }}>
                  {t('common.status')}
                </span>
                <div className="mt-2.5 space-y-1.5">
                  <MicroStat count={stats.drafts} label="DRF" color="var(--color-icon-muted)" />
                  <MicroStat count={stats.streakActive} label="ACT" color="#fbbf24" />
                  <MicroStat count={stats.pending} label="PND" color="#fb923c" />
                  <MicroStat count={stats.finalized} label="DONE" color="#84cc16" />
                </div>
              </div>
            </div>
          )}

          {/* Action row */}
          {onAdd && (
            <div className="mt-5">
              <button
                type="button"
                onClick={onAdd}
                className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
                style={{
                  background: chartHex,
                  boxShadow: `0 4px 20px ${chartHex}35`,
                }}
              >
                <Plus className="size-4" />
                {addLabel || t('entry.newEntry')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
          boxShadow: "0 4px 24px rgba(0,0,0,0.2), inset 0 1px 0 var(--color-border-subtle)",
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
