"use client";

import { useState } from "react";
import { ChevronDown, Trophy } from "lucide-react";
import { compare } from "@/lib/analytics/compare";
import { pct, catColor } from "./AnalyticsChartsCore";

export function Leaderboard({ users }: { users: { email: string; name: string; entryCount: number; streakWins: number }[] }) {
  const top = users.slice(0, 10);
  if (top.length === 0) {
    return <div className="text-sm text-slate-400">No users with entries yet</div>;
  }

  const medals = ["\u{1F451}", "\u{1F948}", "\u{1F949}"];
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
                  ? "border-amber-200 bg-gradient-to-b from-amber-50 to-white shadow-sm"
                  : "border-slate-200 bg-gradient-to-b from-slate-50 to-white"
              } ${isFirst ? "pb-5" : "pb-3"}`}
            >
              <span className="text-xl">{medals[idx]}</span>
              <div
                className={`mt-1 flex items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600 ${
                  isFirst ? "size-14" : "size-10"
                }`}
              >
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="mt-2 w-full truncate text-xs font-semibold text-slate-800">
                {user.name}
              </div>
              <div className="text-lg font-bold text-slate-900">{user.entryCount}</div>
              <div className="text-[10px] text-slate-400">entries</div>
              {user.streakWins > 0 && (
                <div className="mt-1 flex items-center gap-0.5 text-[10px] text-amber-600">
                  <Trophy className="size-3" /> {user.streakWins}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {rest.length > 0 && (
        <div className="rounded-lg border border-slate-200">
          {rest.map((user, i) => (
            <div
              key={user.email}
              className={`flex items-center gap-3 px-4 py-2.5 ${
                i % 2 === 0 ? "bg-white" : "bg-slate-50"
              } ${i < rest.length - 1 ? "border-b border-slate-100" : ""}`}
            >
              <span className="w-5 text-xs font-bold text-slate-400">#{i + 4}</span>
              <div className="flex size-7 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-700">{user.name}</div>
              </div>
              <div className="text-sm font-semibold tabular-nums text-slate-900">
                {user.entryCount}
              </div>
              {user.streakWins > 0 && (
                <div className="flex items-center gap-0.5 text-xs text-amber-600">
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
    { label: "Total Eligible", value: activated + wins, color: "bg-slate-500" },
    { label: "In Progress", value: activated, color: "bg-amber-500" },
    { label: "Completed", value: wins, color: "bg-emerald-500" },
  ];
  const maxVal = Math.max(...bars.map((b) => b.value), 1);

  return (
    <div className="space-y-3">
      {bars.map((bar) => (
        <div key={bar.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">{bar.label}</span>
            <span className="font-semibold text-slate-800">{bar.value}</span>
          </div>
          <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${bar.color} transition-all duration-700`}
              style={{ width: `${pct(bar.value, maxVal)}%` }}
            />
          </div>
        </div>
      ))}
      {total > 0 && (
        <div className="text-xs text-slate-400">
          Completion rate: {pct(wins, activated + wins)}%
        </div>
      )}
    </div>
  );
}

export function CategoryRow({
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
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
      >
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: catColor(slug) }} />
        <span className="w-28 shrink-0 truncate text-sm font-medium text-slate-700 sm:w-36">{name}</span>
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
            style={{ width: `${barPct}%`, backgroundColor: catColor(slug) }}
          />
        </div>
        <span className="w-12 text-right text-sm font-semibold tabular-nums text-slate-800">
          {count}
        </span>
        {c.direction !== "flat" && (
          <span
            className={`text-[10px] font-medium ${
              c.direction === "up" ? "text-emerald-600" : "text-red-500"
            }`}
          >
            {c.direction === "up" ? "\u2191" : "\u2193"} {Math.abs(c.percentChange)}%
          </span>
        )}
        <ChevronDown
          className={`size-4 text-slate-300 transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>
      {expanded && Object.keys(statusBreakdown).length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pb-2.5 pl-9">
          {Object.entries(statusBreakdown).map(([status, cnt]) => (
            <span
              key={status}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500"
            >
              {status}: {cnt}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
