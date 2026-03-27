"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import Link from "next/link";
import SelectDropdown from "@/components/controls/SelectDropdown";
import {
  BarChart3,
  ChevronRight,
  Search,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
  Minus,
  UserCheck,
  Users,
  UserX,
  X,
  Flame,
  Trophy,
} from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { formatNumber } from "@/lib/i18n/locale";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { ActivityTrend, UserProfile, UserStats } from "@/lib/types/admin";

type Props = {
  initialUsers: UserProfile[];
  initialStats: UserStats;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelative(ts: string | null): string {
  if (!ts) return "Never";
  const diff = Date.now() - Date.parse(ts);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function completionColor(rate: number): string {
  if (rate >= 80) return "bg-emerald-500/15";
  if (rate >= 50) return "bg-amber-500/15";
  return "bg-red-400";
}

function trendIcon(trend: ActivityTrend) {
  switch (trend) {
    case "rising":
      return <TrendingUp className="size-3.5 text-emerald-500" />;
    case "declining":
      return <TrendingDown className="size-3.5 text-amber-500" />;
    case "stable":
      return <Minus className="size-3.5 text-[var(--color-text-secondary)]" />;
    case "inactive":
      return <X className="size-3.5 text-red-400" />;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AnimatedCount({ value }: { value: number }) {
  const display = useCountUp(value, 400);
  return <>{formatNumber(display, "en")}</>;
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className={`flex size-10 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="size-5 text-white" />
      </div>
      <div>
        <div className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">
          <AnimatedCount value={value} />
        </div>
        <div className="text-xs text-[var(--color-text-secondary)]">{label}</div>
      </div>
    </div>
  );
}

function Avatar({ user, size = "md" }: { user: UserProfile; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = size === "lg" ? "size-16" : size === "md" ? "size-11" : "size-8";
  const textSize = size === "lg" ? "text-lg" : size === "md" ? "text-sm" : "text-xs";

  if (user.image) {
    return (
      <div className="relative">
        <Image
          src={user.image}
          alt={user.name}
          width={size === "lg" ? 64 : size === "md" ? 44 : 32}
          height={size === "lg" ? 64 : size === "md" ? 44 : 32}
          className={`${sizeClasses} rounded-full ring-2 ring-[var(--color-card-bg)] shadow-sm object-cover`}
          referrerPolicy="no-referrer"
        />
        {user.role === "admin" && (
          <div className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-indigo-500/15 ring-2 ring-[var(--color-card-bg)]">
            <Shield className="size-2.5 text-white" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        className={`${sizeClasses} flex items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-gradient-from)] to-[var(--color-gradient-to)] ring-2 ring-[var(--color-card-bg)] shadow-sm`}
      >
        <span className={`${textSize} font-bold text-white`}>{initials(user.name)}</span>
      </div>
      {user.role === "admin" && (
        <div className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-indigo-500/15 ring-2 ring-[var(--color-card-bg)]">
          <Shield className="size-2.5 text-white" />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// User Card
// ---------------------------------------------------------------------------

function UserCard({ user, rank }: { user: UserProfile; rank: number }) {
  const { t } = useTranslation();
  const isTopPerformer = rank <= 3 && user.totalEntries > 0;
  const isNew = useMemo(
    () =>
      user.firstSeenAt &&
      // eslint-disable-next-line react-hooks/purity
      Date.now() - Date.parse(user.firstSeenAt) < 30 * 24 * 60 * 60 * 1000,
    [user.firstSeenAt],
  );

  return (
    <Link
      href={`/admin/users/${encodeURIComponent(user.email)}`}
      className={`group block rounded-xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
        isTopPerformer
          ? "border-t-2 border-t-amber-400 border-[var(--color-card-border)] bg-[var(--color-card-bg)]"
          : user.totalEntries === 0
          ? "border-[var(--color-card-border)] bg-[var(--color-body-bg)]/50"
          : "border-[var(--color-card-border)] bg-[var(--color-card-bg)]"
      } ${
        rank <= 8
          ? `animate-fade-in-up stagger-${rank}`
          : ""
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <Avatar user={user} />

        {/* Identity */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-[var(--color-text-primary)] truncate">{user.name}</span>
            {user.role === "admin" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs font-medium text-indigo-700">
                <Shield className="size-3" />
                Admin
              </span>
            )}
            {isTopPerformer && (
              <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                Top {rank}
              </span>
            )}
            {isNew && (
              <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                New
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-[var(--color-text-secondary)] font-mono truncate">{user.email}</div>
          {(user.department || user.designation) && (
            <div className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              {[user.department, user.designation].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>

        {/* Status + trend */}
        <div className="flex items-center gap-2 shrink-0">
          {trendIcon(user.activityTrend)}
          <span
            className={`size-2 rounded-full ${
              user.isActive ? "bg-emerald-500/15" : "bg-[var(--color-text-muted)]"
            }`}
            title={user.isActive ? "Active" : "Inactive"}
          />
          <ChevronRight className="size-4 text-[var(--color-text-muted)] transition-transform duration-200 group-hover:translate-x-1 group-hover:text-[var(--color-text-secondary)]" />
        </div>
      </div>

      {/* Stats */}
      {user.totalEntries > 0 ? (
        <>
          <div className="mt-4 grid grid-cols-4 gap-2">
            <div className="rounded-lg bg-[var(--color-body-bg)] px-3 py-2 text-center">
              <div className="text-lg font-bold text-[var(--color-text-primary)]">{user.totalEntries}</div>
              <div className="text-[10px] text-[var(--color-text-secondary)]">{t("dashboard.entries")}</div>
            </div>
            <div className="rounded-lg bg-[var(--color-body-bg)] px-3 py-2 text-center">
              <div className="text-lg font-bold text-[var(--color-text-primary)]">
                {(user.entriesByStatus["GENERATED"] ?? 0) + (user.entriesByStatus["EDIT_GRANTED"] ?? 0)}
              </div>
              <div className="text-[10px] text-[var(--color-text-secondary)]">{t("dashboard.done")}</div>
            </div>
            <div className="rounded-lg bg-[var(--color-body-bg)] px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1 text-lg font-bold text-[var(--color-text-primary)]">
                <Flame className="size-3.5 text-amber-500" />
                {user.streakActivated}
              </div>
              <div className="text-[10px] text-[var(--color-text-secondary)]">{t("dashboard.active")}</div>
            </div>
            <div className="rounded-lg bg-[var(--color-body-bg)] px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1 text-lg font-bold text-[var(--color-text-primary)]">
                <Trophy className="size-3.5 text-amber-500" />
                {user.streakWins}
              </div>
              <div className="text-[10px] text-[var(--color-text-secondary)]">{t("dashboard.wins")}</div>
            </div>
          </div>

          {/* Completion bar */}
          <div className="mt-3 flex items-center gap-2">
            <div className="relative h-1.5 flex-1 rounded-full bg-[var(--color-dropdown-hover)]">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${completionColor(user.completionRate)}`}
                style={{ width: `${Math.min(user.completionRate, 100)}%` }}
              />
            </div>
            <span className="text-xs text-[var(--color-text-secondary)] tabular-nums">{user.completionRate}%</span>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-[var(--color-card-border)] bg-[var(--color-body-bg)] px-4 py-3 text-center">
          <p className="text-xs text-[var(--color-text-secondary)]">{t("adminUsers.noEntriesYet")}</p>
        </div>
      )}

      {/* Last active */}
      <div className="mt-2 text-[10px] text-[var(--color-text-secondary)]">
        {t("adminUsers.lastActive")}: {formatRelative(user.lastActiveAt)}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Filter Bar
// ---------------------------------------------------------------------------

import { type UserManagementFilters as Filters } from "./adminLocalTypes";

const DEFAULT_FILTERS: Filters = {
  search: "",
  role: "all",
  activity: "all",
  sort: "totalEntries",
};

function FilterBar({
  filters,
  onChange,
  matchCount,
  totalCount,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  matchCount: number;
  totalCount: number;
}) {
  const { t } = useTranslation();
  return (
    <div className="sticky top-20 z-10 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder={t("adminUsers.searchPlaceholder")}
            aria-label="Search users"
            className="h-9 w-full rounded-lg border border-[var(--color-card-border)] bg-[var(--color-card-bg)] pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-text-primary)]/10"
          />
        </div>

        {/* Role toggle */}
        <div className="flex rounded-lg border border-[var(--color-card-border)] bg-[var(--color-body-bg)] p-0.5">
          {(["all", "user", "admin"] as const).map((r) => (
            <button
              key={r}
              onClick={() => onChange({ ...filters, role: r })}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                filters.role === r
                  ? "bg-[var(--color-card-bg)] text-[var(--color-text-primary)] shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {r === "all" ? t("adminUsers.all") : r === "admin" ? t("adminUsers.admins") : t("adminUsers.users")}
            </button>
          ))}
        </div>

        {/* Activity toggle */}
        <div className="flex rounded-lg border border-[var(--color-card-border)] bg-[var(--color-body-bg)] p-0.5">
          {(["all", "active", "inactive"] as const).map((a) => (
            <button
              key={a}
              onClick={() => onChange({ ...filters, activity: a })}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                filters.activity === a
                  ? "bg-[var(--color-card-bg)] text-[var(--color-text-primary)] shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {a === "all" ? t("adminUsers.all") : a === "active" ? t("adminUsers.active") : t("adminUsers.inactive")}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="w-44">
          <SelectDropdown
            value={filters.sort}
            onChange={(value) => onChange({ ...filters, sort: value })}
            options={[
              { label: t("adminUsers.sortByMostEntries"), value: "totalEntries" },
              { label: t("adminUsers.sortByMostRecent"), value: "lastActiveAt" },
              { label: t("adminUsers.sortByName"), value: "name" },
              { label: t("adminUsers.sortByStreakWins"), value: "streakWins" },
              { label: t("adminUsers.sortByCompletionRate"), value: "completionRate" },
            ]}
            placeholder={t("adminUsers.sortPlaceholder")}
          />
        </div>
      </div>

      <div className="mt-2 text-xs text-[var(--color-text-secondary)]">
        {t("adminUsers.showing")} {matchCount} {t("adminUsers.of")} {totalCount} {t("adminUsers.users")}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function UserManagement({ initialUsers, initialStats }: Props) {
  const { t } = useTranslation();
  const [users] = useState(initialUsers);
  const [stats] = useState(initialStats);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  // Client-side filtering
  const filtered = useMemo(() => {
    let result = [...users];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.department?.toLowerCase().includes(q) ?? false)
      );
    }

    if (filters.role !== "all") {
      result = result.filter((u) => u.role === filters.role);
    }

    if (filters.activity === "active") {
      result = result.filter((u) => u.isActive);
    } else if (filters.activity === "inactive") {
      result = result.filter((u) => !u.isActive);
    }

    // Sort
    const sortField = filters.sort;
    result.sort((a, b) => {
      switch (sortField) {
        case "name":
          return a.name.localeCompare(b.name);
        case "totalEntries":
          return b.totalEntries - a.totalEntries;
        case "streakWins":
          return b.streakWins - a.streakWins;
        case "completionRate":
          return b.completionRate - a.completionRate;
        case "lastActiveAt": {
          const aMs = a.lastActiveAt ? Date.parse(a.lastActiveAt) : 0;
          const bMs = b.lastActiveAt ? Date.parse(b.lastActiveAt) : 0;
          return bMs - aMs;
        }
        default:
          return b.totalEntries - a.totalEntries;
      }
    });

    return result;
  }, [users, filters]);

  return (
    <div className="space-y-6">
      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label={t("adminUsers.totalUsers")} value={stats.totalUsers} icon={Users} accent="bg-blue-500/15" />
        <StatCard label={t("adminUsers.active90d")} value={stats.activeUsers} icon={UserCheck} accent="bg-emerald-500/15" />
        <StatCard label={t("adminUsers.inactive")} value={stats.inactiveUsers} icon={UserX} accent="bg-[var(--color-text-muted)]" />
        <StatCard label={t("adminUsers.avgEntries")} value={stats.averageEntriesPerUser} icon={BarChart3} accent="bg-amber-500/15" />
        <StatCard label={t("adminUsers.avgCompletion")} value={stats.averageCompletionRate} icon={Target} accent="bg-purple-500/15" />
      </div>

      {/* Quick summary pills */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-[var(--color-dropdown-hover)] px-3 py-1 text-[var(--color-text-secondary)]">
          {stats.totalUsers} {t("adminUsers.users")}
        </span>
        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-700">
          {stats.activeUsers} {t("adminUsers.active")}
        </span>
        {stats.inactiveUsers > 0 && (
          <span className="rounded-full bg-[var(--color-dropdown-hover)] px-3 py-1 text-[var(--color-text-secondary)]">
            {stats.inactiveUsers} {t("adminUsers.inactive")}
          </span>
        )}
        {stats.adminUsers > 0 && (
          <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-indigo-700">
            {stats.adminUsers} {t("adminUsers.admins")}
          </span>
        )}
      </div>

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        matchCount={filtered.length}
        totalCount={users.length}
      />

      {/* User cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.map((user, i) => (
          <UserCard key={user.email} user={user} rank={i + 1} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-text-muted)] bg-[var(--color-body-bg)] py-16 text-center">
          <Users className="size-8 text-[var(--color-text-muted)] mb-3" />
          <div className="text-sm font-medium text-[var(--color-text-secondary)]">{t("adminUsers.noUsersMatch")}</div>
          <div className="mt-1 text-xs text-[var(--color-text-secondary)]">{t("adminUsers.tryAdjustingFilters")}</div>
        </div>
      )}
    </div>
  );
}
