"use client";

import Link from "next/link";
import EntryCategoryMarker from "@/components/entry/EntryCategoryMarker";
import { getEntryListCardClass } from "@/components/entry/entryCardStyles";
import type { EntryDisplayCategory, EntryStreakDisplayState } from "@/lib/entries/displayLifecycle";

function formatEntryTimestamp(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

type EntryListCardShellProps = {
  category: EntryDisplayCategory;
  index: number;
  title: React.ReactNode;
  href: string;
  streakState?: EntryStreakDisplayState;
  badges?: React.ReactNode;
  subtitle?: React.ReactNode;
  createdAt?: string;
  updatedAt?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
};

export default function EntryListCardShell({
  category,
  index,
  title,
  href,
  streakState = "none",
  badges,
  subtitle,
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

  return (
    <div className={getEntryListCardClass(category)}>
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <EntryCategoryMarker category={category} index={index} streakState={streakState} />
              <Link href={href} className="text-base font-semibold hover:opacity-80">
                {title}
              </Link>
              {badges}
            </div>
            {subtitle ? <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div> : null}
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>Added: {formatEntryTimestamp(createdAt)}</span>
              {showUpdated ? <span>Updated: {formatEntryTimestamp(updatedAt)}</span> : null}
            </div>
          </div>

          {actions ? <div className="flex shrink-0 flex-col items-end gap-2">{actions}</div> : null}
        </div>

        {children}
      </div>
    </div>
  );
}
