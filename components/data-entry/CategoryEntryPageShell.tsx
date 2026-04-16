"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import EntryShell from "@/components/entry/EntryShell";
import SectionCard from "@/components/layout/SectionCard";
import EditorProgressHeader from "@/components/data-entry/EditorProgressHeader";
import { EditorStatusBanners } from "@/components/data-entry/EditorStatusBanner";
import EditorMetadataFooter from "@/components/data-entry/EditorMetadataFooter";
import { computeFieldProgress } from "@/lib/entries/fieldProgress";
import type { EditTimeRemaining } from "@/lib/entries/workflow";
import { getCategoryConfig, type CategorySlug } from "@/data/categoryRegistry";
import { getCategoryIcon } from "@/lib/ui/categoryIcons";
import { dataEntryHome } from "@/lib/entryNavigation";
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
      className="rounded-2xl p-6 text-sm text-white/30"
      style={{
        background: "rgba(8,10,18,0.45)",
        border: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      {message}
    </div>
  );
}

/* ── DARK MICRO-STAT PILL (L3 — dark inside bright panel) ── */
function MicroStat({ count, label, color }: { count: number; label: string; color: string }) {
  if (count === 0) return null;
  return (
    <div
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
      style={{
        background: "rgba(0,0,0,0.50)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <span className="font-mono text-sm font-black tabular-nums" style={{ color }}>
        {count}
      </span>
      <span className="text-[9px] font-bold uppercase tracking-widest text-white/35">
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

  return (
    <div className="mb-6 animate-fade-in-up">
      {/* ═══ OUTER CONTAINER — dark card with bright top accent ═══ */}
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          background: `linear-gradient(165deg, rgba(15,22,42,0.95) 0%, rgba(10,15,30,0.90) 100%)`,
          border: `1px solid ${chartHex}20`,
          boxShadow: `0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)`,
        }}
      >
        {/* ── BRIGHT TOP ACCENT BAR (like dashboard) ── */}
        <div
          className="h-1"
          style={{
            background: `linear-gradient(90deg, ${chartHex} 0%, ${chartHex}60 60%, transparent 100%)`,
            boxShadow: `0 2px 12px ${chartHex}30`,
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
          className="absolute -right-6 -bottom-6 pointer-events-none select-none"
          style={{ opacity: 0.03 }}
        >
          {/* eslint-disable-next-line react-hooks/static-components */}
          <Icon className="size-48" style={{ color: chartHex }} />
        </div>

        <div className="relative p-6 sm:p-8">
          {/* Back link */}
          <Link
            href={dataEntryHome()}
            className="mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-white/30 hover:text-white/60 transition-all group/back"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover/back:-translate-x-0.5" />
            {t('nav.dataEntry')}
          </Link>

          {/* ── HUD corner coordinates ── */}
          <div className="absolute top-3 right-4 font-mono text-[9px] text-white/10 tracking-wider select-none pointer-events-none">
            [{category.toUpperCase().replace(/-/g, ".")}]
          </div>

          {/* Identity row — icon pill + title */}
          <div className="flex items-center gap-3.5">
            <div
              className="flex size-14 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: `${chartHex}20`,
                border: `1px solid ${chartHex}35`,
                boxShadow: `0 0 24px ${chartHex}15`,
              }}
            >
              {/* eslint-disable-next-line react-hooks/static-components */}
              <Icon className="size-7" style={{ color: chartHex }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title || "Entries"}</h1>
              {subtitle ? (
                <p className="mt-0.5 text-sm text-white/45 max-w-md line-clamp-2">{subtitle}</p>
              ) : null}
            </div>
          </div>

          {/* ═══ L2: SUB-PANELS ROW — cards inside the card ═══ */}
          {stats && stats.total > 0 && (
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Total entries panel */}
              <div
                className="rounded-xl px-4 py-3.5"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
                  {t('dashboard.totalEntries')}
                </span>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="font-mono text-3xl font-black tracking-tighter" style={{ color: chartHex }}>
                    {stats.total}
                  </span>
                  <span className="text-[10px] text-white/20">
                    {stats.total === 1 ? t('dashboard.entry') : t('dashboard.entries')}
                  </span>
                </div>
              </div>

              {/* Completion ring panel */}
              <div
                className="rounded-xl px-4 py-3.5 hidden sm:flex items-center justify-center"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <CompletionRing stats={stats} accentHex={chartHex} />
              </div>

              {/* Status breakdown panel */}
              <div
                className="rounded-xl px-4 py-3.5"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/40">
                  {t('common.status')}
                </span>
                <div className="mt-2 space-y-1.5">
                  <MicroStat count={stats.drafts} label="DRF" color="rgba(255,255,255,0.5)" />
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
                className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  background: chartHex,
                  boxShadow: `0 4px 16px ${chartHex}25`,
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
  onAdd,
  addLabel,
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
    <div
      className="rounded-2xl p-12 text-center max-w-md mx-auto animate-fade-in-up stagger-2"
      style={{
        background: "rgba(255,255,255,0.015)",
        border: "1px dashed rgba(255,255,255,0.05)",
      }}
    >
      <div
        className="mx-auto flex size-20 items-center justify-center rounded-2xl"
        style={{ background: `${chartHex}08` }}
      >
        {/* eslint-disable-next-line react-hooks/static-components */}
        <Icon className="size-9 text-white/20" />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-white/40">
        {t('entry.noEntries')}
      </h2>
      <p className="mt-1.5 text-sm text-white/20">
        {t('entry.createFirstEntry')}
      </p>
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-5 inline-flex items-center gap-1.5 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5"
          style={{
            background: chartHex,
            boxShadow: `0 4px 16px ${chartHex}25`,
          }}
        >
          <Plus className="size-4" />
          {addLabel || t('entry.newEntry')}
        </button>
      )}
    </div>
  );
}

/* ═══ PAGE BACKGROUND — BLUE-TINTED WITH GRID + SCANLINE ═══ */
function PageBackground({ chartHex, children }: { chartHex: string; children: React.ReactNode }) {
  return (
    <div className="relative min-h-[80vh]">
      {/* Deep blue gradient background */}
      <div
        className="absolute inset-0 pointer-events-none rounded-3xl"
        style={{
          background: `linear-gradient(175deg, rgba(15,25,50,0.95) 0%, rgba(10,18,38,0.90) 35%, rgba(8,12,24,0.85) 70%, transparent 100%)`,
        }}
      />
      {/* Subtle grid pattern overlay */}
      <div
        className="absolute inset-0 pointer-events-none rounded-3xl"
        style={{
          backgroundImage: `
            linear-gradient(rgba(59,130,246,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.035) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          maskImage: "linear-gradient(to bottom, black 0%, black 60%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 60%, transparent 100%)",
        }}
      />
      {/* Radial accent glow at top */}
      <div
        className="absolute inset-0 pointer-events-none rounded-3xl"
        style={{
          background: `radial-gradient(ellipse 70% 40% at 50% -5%, ${chartHex}12, transparent)`,
        }}
      />
      {/* Animated scan line — sweeps slowly down */}
      <div
        className="absolute inset-x-0 pointer-events-none rounded-3xl overflow-hidden"
        style={{ top: 0, bottom: 0 }}
      >
        <div
          className="absolute inset-x-0 h-24"
          style={{
            background: `linear-gradient(180deg, ${chartHex}06 0%, transparent 100%)`,
            animation: "scanline 8s ease-in-out infinite",
          }}
        />
      </div>
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
                <EditorProgressHeader
                  category={category}
                  progress={progress}
                  isGenerated={isGenerated}
                  streakEligible={streakEligible}
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
