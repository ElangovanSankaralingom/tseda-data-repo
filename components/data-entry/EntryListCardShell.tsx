"use client";

import Link from "next/link";
import {
  Clock,
  Lock,
  Pencil,
  Unlock,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getGroupCardClass } from "@/components/entry/entryCardStyles";
import type { EntryListGroup } from "@/lib/entryCategorization";
import type { EditTimeRemaining } from "@/lib/entries/workflow";

function formatRelativeTime(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

function formatEntryTimestamp(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

const GROUP_ICONS: Record<EntryListGroup, LucideIcon> = {
  streak_runners: Zap,
  on_the_clock: Clock,
  unlocked: Unlock,
  in_the_works: Pencil,
  under_review: Clock,
  locked_in: Lock,
};

const GROUP_ICON_COLORS: Record<EntryListGroup, string> = {
  streak_runners: "text-amber-500",
  on_the_clock: "text-blue-500",
  unlocked: "text-purple-500",
  in_the_works: "text-slate-400",
  under_review: "text-amber-400",
  locked_in: "text-emerald-500",
};

const PROGRESS_BAR_COLORS: Record<string, string> = {
  streak_runners: "bg-amber-400",
  on_the_clock: "bg-blue-400",
  unlocked: "bg-purple-400",
};

function GroupBadge({ group, editTime }: { group: EntryListGroup; editTime?: EditTimeRemaining }) {
  if (group === "in_the_works") {
    return (
      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
        Draft
      </span>
    );
  }

  if (group === "locked_in") {
    return (
      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
        Finalized
      </span>
    );
  }

  if (group === "under_review") {
    return (
      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-600">
        Edit Requested
      </span>
    );
  }

  if (group === "streak_runners" && editTime?.hasEditWindow && !editTime.expired) {
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
        ⚡ {editTime.remainingLabel}
      </span>
    );
  }

  if (group === "on_the_clock" && editTime?.hasEditWindow && !editTime.expired) {
    const isUrgent = editTime.remainingMs < 24 * 60 * 60 * 1000;
    return (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isUrgent ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
      }`}>
        {isUrgent ? "Expires today!" : editTime.remainingLabel}
      </span>
    );
  }

  if (group === "unlocked" && editTime?.hasEditWindow && !editTime.expired) {
    return (
      <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
        Unlocked · {editTime.remainingLabel}
      </span>
    );
  }

  return null;
}

function getEditTimeUrgencyClass(remainingMs: number): string {
  if (remainingMs < 24 * 60 * 60 * 1000) return "text-red-600 font-semibold";
  if (remainingMs < 3 * 24 * 60 * 60 * 1000) return "text-amber-600";
  return "text-slate-500";
}

function TimeInfo({ group, editTime, createdAt, updatedAt }: {
  group: EntryListGroup;
  editTime?: EditTimeRemaining;
  createdAt?: string;
  updatedAt?: string;
}) {
  const showCountdown = group === "streak_runners" || group === "on_the_clock" || group === "unlocked";

  // Editable entries with time remaining
  if (showCountdown && editTime?.hasEditWindow && !editTime.expired) {
    const isUrgent = editTime.remainingMs < 24 * 60 * 60 * 1000;
    const colorClass = getEditTimeUrgencyClass(editTime.remainingMs);

    return (
      <span className={`inline-flex items-center gap-1 text-xs ${colorClass}`}>
        <Clock className={`size-3.5 ${isUrgent ? "animate-subtle-pulse" : ""}`} />
        {isUrgent && editTime.remainingMs < 60 * 60 * 1000 ? "Expires today!" : editTime.remainingLabel}
      </span>
    );
  }

  // Drafts
  if (group === "in_the_works") {
    const time = formatRelativeTime(createdAt);
    return time ? <span className="text-xs text-slate-400">Created {time}</span> : null;
  }

  // Under review
  if (group === "under_review") {
    const time = formatRelativeTime(updatedAt || createdAt);
    return time ? <span className="text-xs text-amber-600">Requested {time}</span> : null;
  }

  // Finalized
  if (group === "locked_in") {
    const time = formatRelativeTime(updatedAt || createdAt);
    return time ? <span className="text-xs text-slate-400">Finalized {time}</span> : null;
  }

  // Fallback
  const time = formatRelativeTime(updatedAt || createdAt);
  return time ? <span className="text-xs text-slate-400">Updated {time}</span> : null;
}

function EditWindowProgressBar({ group, editTime }: { group: EntryListGroup; editTime?: EditTimeRemaining }) {
  if (!editTime?.hasEditWindow || editTime.expired) return null;

  const barColor = PROGRESS_BAR_COLORS[group];
  if (!barColor) return null;

  const totalWindowMs = editTime.remainingMs < 3 * 24 * 60 * 60 * 1000
    ? 3 * 24 * 60 * 60 * 1000
    : editTime.remainingMs * 1.5;
  const elapsed = totalWindowMs - editTime.remainingMs;
  const progress = Math.min(100, Math.max(0, (elapsed / totalWindowMs) * 100));
  const isUrgent = progress > 75;
  const isWarning = progress > 50;

  const fillColor = isUrgent ? "bg-red-400" : isWarning ? "bg-amber-400" : barColor;

  return (
    <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden rounded-b-xl">
      <div
        className={`h-full transition-all duration-700 ${fillColor}`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

type EntryListCardShellProps = {
  group: EntryListGroup;
  index: number;
  title: React.ReactNode;
  href: string;
  editTime?: EditTimeRemaining;
  badges?: React.ReactNode;
  subtitle?: React.ReactNode;
  metadata?: React.ReactNode;
  createdAt?: string;
  updatedAt?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
};

export default function EntryListCardShell({
  group,
  index,
  title,
  href,
  editTime,
  badges,
  subtitle,
  metadata,
  createdAt,
  updatedAt,
  actions,
  children,
}: EntryListCardShellProps) {
  const Icon = GROUP_ICONS[group];
  const iconColor = GROUP_ICON_COLORS[group];
  const staggerClass = index < 8 ? `stagger-${index + 1}` : "";

  return (
    <div className={`${getGroupCardClass(group)} group relative animate-fade-in-up ${staggerClass}`}>
      {/* Row 1 — Identity */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Icon className={`size-3.5 shrink-0 ${iconColor}`} />
            <Link href={href} className="text-base font-semibold text-slate-900 hover:text-slate-700 truncate transition-colors">
              {title}
            </Link>
            <GroupBadge group={group} editTime={editTime} />
            {badges}
          </div>
          {subtitle ? <div className="mt-0.5 pl-5.5 text-sm text-slate-600">{subtitle}</div> : null}
        </div>
      </div>

      {/* Row 2 — Details */}
      {(children || metadata) && (
        <div className="mt-2 pl-5.5">
          {children}
          {metadata && !children ? (
            <div className="text-xs text-slate-400">{metadata}</div>
          ) : null}
        </div>
      )}

      {/* Row 3 — Footer: time info + actions */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
        <TimeInfo group={group} editTime={editTime} createdAt={createdAt} updatedAt={updatedAt} />
        {actions ? (
          <div className="flex shrink-0 items-center gap-2 sm:opacity-0 sm:translate-x-2 sm:group-hover:opacity-100 sm:group-hover:translate-x-0 transition-all duration-200">
            {actions}
          </div>
        ) : null}
      </div>

      {/* Time progress bar — flush bottom */}
      <EditWindowProgressBar group={group} editTime={editTime} />
    </div>
  );
}
