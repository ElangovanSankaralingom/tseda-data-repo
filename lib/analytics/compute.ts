import "server-only";

import { getCategoryConfig } from "@/data/categoryRegistry";
import { listUsers } from "@/lib/admin/integrity";
import { CATEGORY_KEYS } from "@/lib/categories";
import { readCategoryEntries } from "@/lib/dataStore";
import type { CategoryKey } from "@/lib/entries/types";
import {
  normalizeEntryStatus,
  type EntryStateLike,
} from "@/lib/entries/workflow";
import { getProfileByEmail } from "@/lib/profileStore";
import type { Result } from "@/lib/result";
import { safeAction } from "@/lib/safeAction";
import {
  computeCanonicalStreakSnapshot,
  type StreakProgressAggregateEntry,
} from "@/lib/streakProgress";
import type { Entry } from "@/lib/types/entry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserSummary = {
  email: string;
  name: string;
  entryCount: number;
  streakWins: number;
  streakActivated: number;
  lastActivity: string | null;
  entriesByCategory: Record<string, number>;
  entriesByStatus: Record<string, number>;
};

export type EntryDataPoint = {
  date: string;
  category: string;
  status: string;
  userEmail: string;
};

export type EditRequestDataPoint = {
  requestedAt: string;
  grantedAt: string | null;
  category: string;
  userEmail: string;
};

export type StreakSummary = {
  totalActivated: number;
  totalWins: number;
  byCategory: Record<string, { activated: number; wins: number }>;
  byUser: { email: string; name: string; wins: number }[];
};

export type CategorySummary = {
  slug: string;
  name: string;
  totalEntries: number;
  entriesByStatus: Record<string, number>;
  uniqueUsers: number;
  streakActivated: number;
  streakWins: number;
};

export type AnalyticsSnapshot = {
  computedAt: string;
  durationMs: number;
  totalUsers: number;
  totalEntries: number;
  users: UserSummary[];
  entries: EntryDataPoint[];
  editRequests: EditRequestDataPoint[];
  streaks: StreakSummary;
  categories: CategorySummary[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateString(isoString: unknown): string | null {
  if (typeof isoString !== "string") return null;
  const trimmed = isoString.trim();
  if (!trimmed) return null;
  const match = /^\d{4}-\d{2}-\d{2}/.exec(trimmed);
  return match ? match[0] : null;
}

function toISO(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : trimmed;
}

function getDisplayName(
  email: string,
  profile: { googleDisplayName?: string; userPreferredName?: string } | null,
): string {
  return (
    profile?.userPreferredName ||
    profile?.googleDisplayName ||
    email.split("@")[0]
  );
}

function maxISO(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function computeAnalytics(): Promise<Result<AnalyticsSnapshot>> {
  return safeAction(
    async () => {
      const start = performance.now();

      const usersResult = await listUsers();
      if (!usersResult.ok) throw usersResult.error;
      const emails = usersResult.data;

      const allUsers: UserSummary[] = [];
      const allEntries: EntryDataPoint[] = [];
      const allEditRequests: EditRequestDataPoint[] = [];

      // Per-category accumulators
      const catEntryCount: Record<string, number> = {};
      const catStatusCount: Record<string, Record<string, number>> = {};
      const catUserSets: Record<string, Set<string>> = {};
      const catStreakActivated: Record<string, number> = {};
      const catStreakWins: Record<string, number> = {};

      for (const key of CATEGORY_KEYS) {
        catEntryCount[key] = 0;
        catStatusCount[key] = {};
        catUserSets[key] = new Set();
        catStreakActivated[key] = 0;
        catStreakWins[key] = 0;
      }

      // Global streak by-user accumulator
      const streakByUser: { email: string; name: string; wins: number }[] = [];

      // Process users in parallel
      await Promise.all(
        emails.map(async (email) => {
          const profile = await getProfileByEmail(email);
          const displayName = getDisplayName(email, profile);

          const entriesByCategory: Record<string, number> = {};
          const entriesByStatus: Record<string, number> = {};
          let lastActivity: string | null = null;
          let entryCount = 0;
          const streakInputs: StreakProgressAggregateEntry[] = [];

          for (const category of CATEGORY_KEYS) {
            const entries = await readCategoryEntries(email, category);
            entriesByCategory[category] = entries.length;
            entryCount += entries.length;

            if (entries.length > 0) {
              catUserSets[category].add(email);
            }
            catEntryCount[category] += entries.length;

            for (const entry of entries) {
              // Status
              const status = normalizeEntryStatus(
                entry as unknown as EntryStateLike,
              );
              entriesByStatus[status] = (entriesByStatus[status] ?? 0) + 1;
              catStatusCount[category][status] =
                (catStatusCount[category][status] ?? 0) + 1;

              // Last activity
              const created = toISO(entry.createdAt);
              const updated = toISO(entry.updatedAt);
              lastActivity = maxISO(lastActivity, maxISO(created, updated));

              // Entry data point
              const dateStr = toDateString(entry.createdAt);
              if (dateStr) {
                allEntries.push({
                  date: dateStr,
                  category,
                  status,
                  userEmail: email,
                });
              }

              // Edit request data point
              const requestedAt = toISO(entry.editRequestedAt);
              if (requestedAt) {
                allEditRequests.push({
                  requestedAt,
                  grantedAt: toISO(entry.editGrantedAt),
                  category,
                  userEmail: email,
                });
              }

              // Streak input
              streakInputs.push({
                ...(entry as Entry),
                categoryKey: category as CategoryKey,
              });
            }
          }

          // Compute streak for this user
          const streakSnap = computeCanonicalStreakSnapshot(streakInputs);

          // Accumulate per-category streak totals
          for (const category of CATEGORY_KEYS) {
            const catData = streakSnap.byCategory[category];
            if (catData) {
              catStreakActivated[category] += catData.activated;
              catStreakWins[category] += catData.wins;
            }
          }

          const userSummary: UserSummary = {
            email,
            name: displayName,
            entryCount,
            streakWins: streakSnap.streakWinsCount,
            streakActivated: streakSnap.streakActivatedCount,
            lastActivity,
            entriesByCategory,
            entriesByStatus,
          };

          allUsers.push(userSummary);
          streakByUser.push({
            email,
            name: displayName,
            wins: streakSnap.streakWinsCount,
          });
        }),
      );

      // Sort users by entryCount descending
      allUsers.sort((a, b) => b.entryCount - a.entryCount);

      // Sort streakByUser by wins descending
      streakByUser.sort((a, b) => b.wins - a.wins);

      // Build StreakSummary
      const streaks: StreakSummary = {
        totalActivated: allUsers.reduce((s, u) => s + u.streakActivated, 0),
        totalWins: allUsers.reduce((s, u) => s + u.streakWins, 0),
        byCategory: Object.fromEntries(
          CATEGORY_KEYS.map((key) => [
            key,
            {
              activated: catStreakActivated[key],
              wins: catStreakWins[key],
            },
          ]),
        ),
        byUser: streakByUser,
      };

      // Build CategorySummary[]
      const categories: CategorySummary[] = CATEGORY_KEYS.map((key) => {
        const config = getCategoryConfig(key);
        return {
          slug: key,
          name: config.label,
          totalEntries: catEntryCount[key],
          entriesByStatus: catStatusCount[key],
          uniqueUsers: catUserSets[key].size,
          streakActivated: catStreakActivated[key],
          streakWins: catStreakWins[key],
        };
      });

      const durationMs = Math.round(performance.now() - start);

      return {
        computedAt: new Date().toISOString(),
        durationMs,
        totalUsers: emails.length,
        totalEntries: allEntries.length,
        users: allUsers,
        entries: allEntries,
        editRequests: allEditRequests,
        streaks,
        categories,
      };
    },
    { context: "analytics.compute" },
  );
}
