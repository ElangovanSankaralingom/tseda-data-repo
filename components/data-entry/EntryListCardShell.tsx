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
import type { EditTimeRemaining } from "@/lib/entries/stateMachine";

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

function EditWindowProgressBar({ group, editTime }: { group: EntryListGroup; editTime?: EditTimeRemaining }) {
  if (!editTime?.hasEditWindow || editTime.expired) return null;

  const barColor = PROGRESS_BAR_COLORS[group];
  if (!barColor) return null;

  // Estimate total window (remaining + elapsed)
  // Use a rough heuristic: if we know expiresAt, we assume the window started at (expiresAt - totalWindow)
  // Since we don't have the start time, use remaining ratio based on typical windows
  const totalWindowMs = editTime.remainingMs < 3 * 24 * 60 * 60 * 1000
    ? 3 * 24 * 60 * 60 * 1000  // 3-day default window
    : editTime.remainingMs * 1.5; // rough estimate
  const elapsed = totalWindowMs - editTime.remainingMs;
  const progress = Math.min(100, Math.max(0, (elapsed / totalWindowMs) * 100));
  const isLow = progress > 80;

  return (
    <div className="mt-3 h-1 w-full rounded-full bg-slate-100">
      <div
        className={`h-1 rounded-full transition-all duration-500 ${isLow ? "bg-red-400" : barColor}`}
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
  const createdTime = createdAt ? new Date(createdAt).getTime() : Number.NaN;
  const updatedTime = updatedAt ? new Date(updatedAt).getTime() : Number.NaN;
  const showUpdated =
    !Number.isNaN(createdTime) &&
    !Number.isNaN(updatedTime) &&
    Math.abs(updatedTime - createdTime) > 60 * 1000;

  const relativeTime = formatRelativeTime(updatedAt || createdAt);
  const Icon = GROUP_ICONS[group];
  const iconColor = GROUP_ICON_COLORS[group];

  return (
    <div className={getGroupCardClass(group)}>
      <div className="space-y-2">
        {/* Title row: icon + title + badge */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Icon className={`size-4 shrink-0 ${iconColor}`} />
              <Link href={href} className="text-base font-semibold text-slate-900 hover:opacity-80">
                {title}
              </Link>
              <GroupBadge group={group} editTime={editTime} />
              {badges}
            </div>
            {subtitle ? <div className="mt-1 pl-6 text-sm text-slate-600">{subtitle}</div> : null}
          </div>
        </div>

        {/* Metadata + actions row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pl-6">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
            {metadata}
            {!metadata && relativeTime ? (
              <span title={`Created: ${formatEntryTimestamp(createdAt)}${showUpdated ? ` | Updated: ${formatEntryTimestamp(updatedAt)}` : ""}`}>
                {showUpdated ? "Updated " : "Created "}{relativeTime}
              </span>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>

        {children}

        {/* Progress bar for timed entries */}
        <EditWindowProgressBar group={group} editTime={editTime} />
      </div>
    </div>
  );
}
