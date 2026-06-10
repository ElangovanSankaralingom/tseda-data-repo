"use client";

import { memo, useState } from "react";
import { ChevronDown, Crown, Medal, Trophy } from "lucide-react";
import { compare } from "@/lib/analytics/compare";
import { pct, catColor } from "./AnalyticsChartsCore";

export function Leaderboard({ users }: { users: { email: string; name: string; entryCount: number; streakWins: number }[] }) {
  const top = users.slice(0, 10);
  if (top.length === 0) {
    return <div className="text-sm text-[var(--color-text-secondary)]">No users with entries yet</div>;
  }

  /* Podium rank marks — lucide icons with tier-metal tokens (no emojis in UI). */
  const rankMarks = [
    { Icon: Crown, color: "var(--color-palette-amber-fg)" },
    { Icon: Medal, color: "var(--color-text-muted)" },
    { Icon: Medal, color: "var(--color-palette-orange-fg)" },
  ];
  const podium = top.slice(0, 3);
  const rest = top.slice(3);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-center gap-3">
        {[1, 0, 2].map((idx) => {
          const user = podium[idx];
          if (!user) return <div key={idx} className="w-28" />;
          const isFirst = idx === 0;
          return (
            <div
              key={user.email}
              className={`flex w-28 flex-col items-center rounded-xl border p-3 text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${
                isFirst
                  ? "border-[var(--color-status-warning-border)] bg-gradient-to-b from-[var(--color-status-warning-bg)] to-[var(--color-glass-bg)] shadow-sm"
                  : "border-[var(--color-glass-border)] bg-gradient-to-b from-[var(--color-body-bg)] to-[var(--color-glass-bg)]"
              } ${isFirst ? "pb-5" : "pb-3"}`}
            >
              {(() => { const { Icon, color } = rankMarks[idx]; return <Icon className="size-5" style={{ color }} strokeWidth={2.2} />; })()}
              <div
                className={`mt-1 flex items-center justify-center rounded-full bg-[var(--color-glass-border)] text-xs font-bold text-[var(--color-text-secondary)] ${
                  isFirst ? "size-14" : "size-10"
                }`}
              >
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="mt-2 w-full truncate text-xs font-semibold text-[var(--color-text-primary)]">
                {user.name}
              </div>
              <div className="text-lg font-bold text-[var(--color-text-primary)]">{user.entryCount}</div>
              <div className="text-[10px] text-[var(--color-text-secondary)]">entries</div>
              {user.streakWins > 0 && (
                <div className="mt-1 flex items-center gap-0.5 text-[10px] text-[var(--color-status-warning)]">
                  <Trophy className="size-3" /> {user.streakWins}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {rest.length > 0 && (
        <div className="rounded-lg border border-[var(--color-glass-border)]">
          {rest.map((user, i) => (
            <div
              key={user.email}
              className={`flex items-center gap-3 px-4 py-2.5 ${
                i % 2 === 0 ? "bg-[var(--color-glass-bg)]" : "bg-[var(--color-body-bg)]"
              } ${i < rest.length - 1 ? "border-b border-[var(--color-divider)]" : ""}`}
            >
              <span className="w-5 text-xs font-bold text-[var(--color-text-secondary)]">#{i + 4}</span>
              <div className="flex size-7 items-center justify-center rounded-full bg-[var(--color-glass-border)] text-[10px] font-bold text-[var(--color-text-secondary)]">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-[var(--color-text-secondary)]">{user.name}</div>
              </div>
              <div className="text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">
                {user.entryCount}
              </div>
              {user.streakWins > 0 && (
                <div className="flex items-center gap-0.5 text-xs text-[var(--color-status-warning)]">
                  <Trophy className="size-3" /> {user.streakWins}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StreakFunnel({
  total,
  activated,
  wins,
}: {
  total: number;
  activated: number;
  wins: number;
}) {
  const bars = [
    { label: "Total Eligible", value: activated + wins, color: "bg-[var(--color-surface-inset-deep)]" },
    { label: "In Progress", value: activated, color: "bg-[var(--color-status-warning-bg)]" },
    { label: "Completed", value: wins, color: "bg-[var(--color-status-success-bg)]" },
  ];
  const maxVal = Math.max(...bars.map((b) => b.value), 1);

  return (
    <div className="space-y-3">
      {bars.map((bar) => (
        <div key={bar.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--color-text-secondary)]">{bar.label}</span>
            <span className="font-semibold text-[var(--color-text-primary)]">{bar.value}</span>
          </div>
          <div className="h-4 w-full overflow-hidden rounded-full bg-[var(--color-dropdown-hover)]">
            <div
              className={`h-full rounded-full ${bar.color} transition-all duration-700`}
              style={{ width: `${pct(bar.value, maxVal)}%` }}
            />
          </div>
        </div>
      ))}
      {total > 0 && (
        <div className="text-xs text-[var(--color-text-secondary)]">
          Completion rate: {pct(wins, activated + wins)}%
        </div>
      )}
    </div>
  );
}

export const CategoryRow = memo(function CategoryRow({
  slug,
  name,
  count,
  maxCount,
  growth,
  statusBreakdown,
}: {
  slug: string;
  name: string;
  count: number;
  maxCount: number;
  growth: { current: number; previous: number };
  statusBreakdown: Record<string, number>;
}) {
  const [expanded, setExpanded] = useState(false);
  const barPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  const c = compare(growth.current, growth.previous);

  return (
    <div className="border-b border-[var(--color-divider)] last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-dropdown-hover)]"
      >
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: catColor(slug) }} />
        <span className="w-28 shrink-0 truncate text-sm font-medium text-[var(--color-text-secondary)] sm:w-36">{name}</span>
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-dropdown-hover)]">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
            style={{ width: `${barPct}%`, backgroundColor: catColor(slug) }}
          />
        </div>
        <span className="w-12 text-right text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">
          {count}
        </span>
        {c.direction !== "flat" && (
          <span
            className={`text-[10px] font-medium ${
              c.direction === "up" ? "text-[var(--color-status-success)]" : "text-[var(--color-status-error)]"
            }`}
          >
            {c.direction === "up" ? "↑" : "↓"} {Math.abs(c.percentChange)}%
          </span>
        )}
        <ChevronDown
          className={`size-4 text-[var(--color-text-muted)] transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>
      {expanded && Object.keys(statusBreakdown).length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pb-2.5 pl-9">
          {Object.entries(statusBreakdown).map(([status, cnt]) => (
            <span
              key={status}
              className="rounded-full bg-[var(--color-dropdown-hover)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]"
            >
              {status}: {cnt}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});
