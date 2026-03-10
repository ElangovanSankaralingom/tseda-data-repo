"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
} from "lucide-react";
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
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-muted-foreground shadow-sm">
      {message}
    </div>
  );
}

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
  const config = getCategoryConfig(category);
  const gradient = config.color.gradient;
  const Icon = useMemo(() => getCategoryIcon(config.icon), [config.icon]);

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${gradient} p-6 sm:p-8 mb-6 animate-fade-in-up`}>
      {/* Back button */}
      <Link
        href={dataEntryHome()}
        className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/80 hover:bg-white/20 hover:text-white transition-all group/back"
      >
        <ArrowLeft className="size-4 transition-transform group-hover/back:-translate-x-0.5" />
        Data Entry
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        {/* Left: icon + title */}
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
            {/* eslint-disable-next-line react-hooks/static-components */}
            <Icon className="size-7 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white">{title || "Entries"}</h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-white/60 max-w-lg">{subtitle}</p>
            ) : null}
          </div>
        </div>

        {/* Right: stat pills */}
        {stats && stats.total > 0 && (
          <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
            <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-white">
              {stats.total} {stats.total === 1 ? "entry" : "entries"}
            </span>
            {stats.streakActive > 0 && (
              <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-amber-300">
                &#9889; {stats.streakActive} in progress
              </span>
            )}
            {stats.drafts > 0 && (
              <span className="rounded-full bg-amber-500/20 px-3 py-1 text-sm text-amber-300">
                {stats.drafts} {stats.drafts === 1 ? "draft" : "drafts"}
              </span>
            )}
            {stats.pending > 0 && (
              <span className="rounded-full bg-blue-500/20 px-3 py-1 text-sm text-blue-300">
                {stats.pending} pending
              </span>
            )}
          </div>
        )}
      </div>

      {/* + New Entry button */}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className={`mt-5 inline-flex items-center gap-1.5 rounded-xl bg-white ${
            config.color.text
          } px-5 py-2.5 text-sm font-semibold shadow-lg hover:bg-white/90 hover:-translate-y-0.5 hover:shadow-xl transition-all duration-200`}
        >
          <Plus className="size-4" />
          {addLabel || "New Entry"}
        </button>
      )}
    </div>
  );
}

function CategoryEmptyState({
  category,
  title,
  onAdd,
  addLabel,
}: {
  category: CategorySlug;
  title?: string;
  onAdd?: () => void;
  addLabel?: string;
}) {
  const config = getCategoryConfig(category);
  const Icon = useMemo(() => getCategoryIcon(config.icon), [config.icon]);
  const accent = config.color.text;
  const bgAccent = config.color.bg;

  return (
    <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center max-w-md mx-auto animate-fade-in-up stagger-2">
      <div className={`mx-auto flex size-24 items-center justify-center rounded-full ${bgAccent}`}>
        {/* eslint-disable-next-line react-hooks/static-components */}
        <Icon className={`size-10 ${accent}`} />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-slate-700">
        No {title?.toLowerCase() || "entries"} yet
      </h2>
      <p className="mt-1.5 text-sm text-slate-500">
        Create your first entry to start tracking
      </p>
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[#1E3A5F] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#162d4a] hover:-translate-y-0.5 transition-all duration-200"
        >
          <Plus className="size-4" />
          {addLabel || "Create First Entry"}
        </button>
      )}
    </div>
  );
}

export default function CategoryEntryPageShell({
  entryShell,
  loading,
  loadingMessage = "Loading...",
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
  // Form mode — enhanced editor layout
  if (showForm) {
    const entry = entryShell.entry as Record<string, unknown> | null;
    const category = entryShell.category;
    const isGenerated = !!entry?.committedAtISO;
    const progress = computeFieldProgress(category, entry, isGenerated);
    const streakEligible = !!entry?.streakEligible;
    // IMPORTANT: isEditable and editTimeRemaining come from the SERVER response
    // (via entryToApiResponse). Do NOT recompute on the client — the server is
    // the single source of truth. For new entries (no server response yet),
    // isEditable defaults to true.
    const editable = entry?.isEditable !== false;
    const editTime = (entry?.editTimeRemaining as EditTimeRemaining | undefined) ?? null;
    const status = typeof entry?.confirmationStatus === "string" ? entry.confirmationStatus : null;

    // Check if this is a new entry (no id yet) — skip status strip for new drafts
    const isNewDraft = !entry?.id || (!isGenerated && status !== "EDIT_REQUESTED" && status !== "DELETE_REQUESTED" && status !== "EDIT_GRANTED" && status !== "ARCHIVED");

    return (
      <EntryShell {...entryShell}>
        <div className="space-y-4">
          {/* Layer 1: Status strip — compact, always visible (except new drafts) */}
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

          {loading ? <LoadingState message={loadingMessage} /> : null}

          {/* Layer 2: Form card with progress bar inside */}
          {!loading && formCard ? (
            <SectionCard className={formCard.className} title={formCard.title} subtitle={formCard.subtitle}>
              {/* Progress bar inside form card (only in edit mode) */}
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

          {/* Layer 7: Metadata footer — collapsed by default */}
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

  // List mode — hero header + list
  const category = entryShell.category;
  const stats = listCard?.stats;
  const hasEntries = stats ? stats.total > 0 : false;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <CategoryHero
        category={category}
        title={entryShell.title}
        subtitle={entryShell.subtitle}
        stats={stats}
        onAdd={onAddEntry}
        addLabel={addEntryLabel}
      />

      {topContent}

      {loading ? <LoadingState message={loadingMessage} /> : null}

      {!loading && listCard && hasEntries ? (
        <div className="animate-fade-in-up stagger-1">
          {listCard.content}
        </div>
      ) : null}

      {!loading && !hasEntries ? (
        <CategoryEmptyState
          category={category}
          title={entryShell.title}
          onAdd={onAddEntry}
          addLabel={addEntryLabel}
        />
      ) : null}

      {confirmationDialog}
    </div>
  );
}
