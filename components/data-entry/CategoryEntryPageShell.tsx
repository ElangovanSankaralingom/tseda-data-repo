"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  FileText,
  Mic,
  Plus,
  Presentation,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import EntryShell from "@/components/entry/EntryShell";
import SectionCard from "@/components/layout/SectionCard";
import EditorProgressHeader from "@/components/data-entry/EditorProgressHeader";
import { EditorStatusBanners } from "@/components/data-entry/EditorStatusBanner";
import EditorStreakCard from "@/components/data-entry/EditorStreakCard";
import EditorMetadataFooter from "@/components/data-entry/EditorMetadataFooter";
import { computeFieldProgress } from "@/lib/entries/fieldProgress";
import { getEditTimeRemaining, isEntryEditable } from "@/lib/entries/workflow";
import { isEntryActivated, isEntryWon } from "@/lib/streakProgress";
import { getCategorySchema, type CategorySlug } from "@/data/categoryRegistry";
import { dataEntryHome } from "@/lib/entryNavigation";
import type { ListStats } from "@/components/data-entry/GroupedEntrySections";

const CATEGORY_GRADIENTS: Record<string, string> = {
  "fdp-attended": "from-blue-600 via-blue-700 to-blue-900",
  "fdp-conducted": "from-emerald-600 via-emerald-700 to-emerald-900",
  "case-studies": "from-amber-600 via-amber-700 to-amber-900",
  "guest-lectures": "from-purple-600 via-purple-700 to-purple-900",
  workshops: "from-rose-600 via-rose-700 to-rose-900",
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "fdp-attended": BookOpen,
  "fdp-conducted": Presentation,
  "case-studies": FileText,
  "guest-lectures": Mic,
  workshops: Wrench,
};

const ACCENT_TEXT: Record<string, string> = {
  "fdp-attended": "text-blue-700",
  "fdp-conducted": "text-emerald-700",
  "case-studies": "text-amber-700",
  "guest-lectures": "text-purple-700",
  workshops: "text-rose-700",
};

type CardContent = {
  title: string;
  subtitle?: string;
  className?: string;
  content: React.ReactNode;
  stats?: ListStats;
};

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
  const gradient = CATEGORY_GRADIENTS[category] ?? "from-slate-600 via-slate-700 to-slate-900";
  const Icon = CATEGORY_ICONS[category] ?? FileText;

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
              <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-amber-200">
                ⚡ {stats.streakActive} in progress
              </span>
            )}
            {stats.drafts > 0 && (
              <span className="rounded-full bg-amber-500/20 px-3 py-1 text-sm text-amber-200">
                {stats.drafts} {stats.drafts === 1 ? "draft" : "drafts"}
              </span>
            )}
            {stats.pending > 0 && (
              <span className="rounded-full bg-blue-500/20 px-3 py-1 text-sm text-blue-200">
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
            ACCENT_TEXT[category] ?? "text-slate-700"
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
  const Icon = CATEGORY_ICONS[category] ?? FileText;
  const accent = ACCENT_TEXT[category] ?? "text-slate-700";
  const bgAccent = accent.replace("text-", "bg-").replace("-700", "-100");

  return (
    <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center max-w-md mx-auto animate-fade-in-up stagger-2">
      <div className={`mx-auto flex size-24 items-center justify-center rounded-full ${bgAccent}`}>
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
          className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 hover:-translate-y-0.5 transition-all duration-200"
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
  onRequestEdit,
  onCancelRequestEdit,
}: CategoryEntryPageShellProps) {
  // Form mode — enhanced editor layout
  if (showForm) {
    const entry = entryShell.entry as Record<string, unknown> | null;
    const category = entryShell.category;
    const progress = computeFieldProgress(category, entry);
    const isGenerated = !!entry?.committedAtISO;
    const streakEligible = !!entry?.streakEligible;
    const schema = getCategorySchema(category);
    const entryWon = entry ? isEntryWon(entry, schema.fields) : false;
    const editable = entry ? isEntryEditable(entry) : true;
    const editTime = entry ? getEditTimeRemaining(entry) : null;
    const status = typeof entry?.confirmationStatus === "string" ? entry.confirmationStatus : null;
    const allFieldsComplete = progress.total > 0 && progress.completed === progress.total;
    const canFinalise = isGenerated && editable && allFieldsComplete;

    return (
      <EntryShell {...entryShell}>
        <div className="space-y-4">
          {/* Progress header */}
          <EditorProgressHeader
            category={category}
            progress={progress}
            isGenerated={isGenerated}
            streakEligible={streakEligible}
            editTimeLabel={editTime?.hasEditWindow && !editTime.expired ? editTime.remainingLabel : undefined}
            canFinalise={canFinalise}
          />

          {/* Status banners */}
          <EditorStatusBanners
            status={status}
            isEditable={editable}
            editTimeLabel={editTime?.hasEditWindow && !editTime.expired ? editTime.remainingLabel : undefined}
            editTimeMs={editTime?.remainingMs}
            expiresAtISO={editTime?.expiresAtISO}
            hasPdf={!!entry?.pdfMeta}
            onRequestEdit={onRequestEdit}
            onCancelRequest={onCancelRequestEdit}
          />

          {/* Streak indicator */}
          {streakEligible && isGenerated ? (
            <EditorStreakCard
              streakEligible={streakEligible}
              isWon={entryWon}
              progress={progress}
            />
          ) : null}

          {topContent}

          {loading ? <LoadingState message={loadingMessage} /> : null}

          {!loading && formCard ? (
            <SectionCard className={formCard.className} title={formCard.title} subtitle={formCard.subtitle}>
              {formCard.content}
            </SectionCard>
          ) : null}

          {/* Metadata footer */}
          {!loading && entry ? (
            <EditorMetadataFooter
              entryId={typeof entry.id === "string" ? entry.id : undefined}
              category={category}
              createdAt={typeof entry.createdAt === "string" ? entry.createdAt : undefined}
              updatedAt={typeof entry.updatedAt === "string" ? entry.updatedAt : undefined}
              committedAt={typeof entry.committedAtISO === "string" ? entry.committedAtISO : undefined}
              streakEligible={streakEligible}
              editWindowExpires={typeof entry.editWindowExpiresAt === "string" ? entry.editWindowExpiresAt : undefined}
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
