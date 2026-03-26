import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { getUsersRootDir } from "@/lib/userStore";
import { CATEGORY_KEYS } from "@/lib/categories";
import { getAdminUser } from "@/lib/admin/roles";
import { getAllProfiles } from "@/lib/profileStore";
import { getCanonicalName } from "@/lib/facultyDirectory";
import type { ActivityTrend, UserProfile, UserStats } from "@/lib/types/admin";

type IndexJson = {
  version?: number;
  userEmail?: string;
  updatedAt?: string;
  totalsByCategory?: Record<string, number>;
  countsByStatus?: Record<string, number>;
  pendingByCategory?: Record<string, number>;
  approvedByCategory?: Record<string, number>;
  lastEntryAtByCategory?: Record<string, string | null>;
  streakSnapshot?: {
    streakActivatedCount?: number;
    streakWinsCount?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

async function readJsonSafe<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function computeActivityTrend(
  lastActiveAt: string | null,
  totalEntries: number,
): ActivityTrend {
  if (totalEntries === 0 || !lastActiveAt) return "inactive";

  const now = Date.now();
  const lastActive = Date.parse(lastActiveAt);
  const daysSinceActive = (now - lastActive) / (1000 * 60 * 60 * 24);

  if (daysSinceActive > 30) return "declining";
  if (daysSinceActive <= 7) return "rising";
  return "stable";
}

export async function listAllUsers(): Promise<UserProfile[]> {
  const usersDir = getUsersRootDir();
  let userDirs: string[];
  try {
    userDirs = await fs.readdir(usersDir);
  } catch {
    return [];
  }

  const profiles = await getAllProfiles();
  const results: UserProfile[] = [];

  for (const dirName of userDirs) {
    const dirPath = path.join(usersDir, dirName);
    const stat = await fs.stat(dirPath).catch(() => null);
    if (!stat?.isDirectory()) continue;

    // The directory name is the sanitized email
    const email = dirName;

    // Read index.json
    const indexPath = path.join(dirPath, "index.json");
    const index = await readJsonSafe<IndexJson>(indexPath);

    // Get profile data
    const profile = profiles[email] ?? profiles[email.toLowerCase()] ?? null;

    // Get admin info
    const adminUser = getAdminUser(email);
    const adminRoles = adminUser?.roles ?? [];

    // Compute entries by category
    const entriesByCategory: Record<string, number> = {};
    let totalEntries = 0;
    if (index?.totalsByCategory) {
      for (const cat of CATEGORY_KEYS) {
        const count = index.totalsByCategory[cat] ?? 0;
        entriesByCategory[cat] = count;
        totalEntries += count;
      }
    }

    // Compute entries by status
    const entriesByStatus: Record<string, number> = {};
    if (index?.countsByStatus) {
      for (const [status, count] of Object.entries(index.countsByStatus)) {
        if (typeof count === "number") {
          entriesByStatus[status] = count;
        }
      }
    }

    // Edit requests count
    const editRequests =
      (entriesByStatus["EDIT_REQUESTED"] ?? 0) +
      (entriesByStatus["DELETE_REQUESTED"] ?? 0);

    // Streak data
    const streakActivated = index?.streakSnapshot?.streakActivatedCount ?? 0;
    const streakWins = index?.streakSnapshot?.streakWinsCount ?? 0;

    // Completion rate: ratio of GENERATED (finalized) entries to total
    const generatedCount = entriesByStatus["GENERATED"] ?? 0;
    const completionRate = totalEntries > 0
      ? Math.round((generatedCount / totalEntries) * 100)
      : 0;

    // Timestamps
    const lastActiveAt = index?.updatedAt ?? null;
    const firstSeenAt = findEarliestTimestamp(index?.lastEntryAtByCategory) ?? null;

    // Activity
    const now = Date.now();
    const isActive = lastActiveAt
      ? (now - Date.parse(lastActiveAt)) / (1000 * 60 * 60 * 24) <= 30
      : false;
    const activityTrend = computeActivityTrend(lastActiveAt, totalEntries);

    // Name resolution
    const name =
      profile?.userPreferredName ||
      profile?.googleDisplayName ||
      getCanonicalName(email) ||
      email.split("@")[0];

    results.push({
      email,
      name,
      image: profile?.googlePhotoURL ?? undefined,
      department: undefined,
      designation: profile?.academic?.designation as string | undefined,
      role: adminRoles.length > 0 ? "admin" : "user",
      adminRoles: adminRoles as string[],
      isActive,
      firstSeenAt,
      lastActiveAt,
      totalEntries,
      entriesByCategory,
      entriesByStatus,
      completionRate,
      streakActivated,
      streakWins,
      editRequests,
      activityTrend,
    });
  }

  return results;
}

function findEarliestTimestamp(
  timestamps: Record<string, string | null> | undefined,
): string | null {
  if (!timestamps) return null;
  let earliest: string | null = null;
  for (const val of Object.values(timestamps)) {
    if (val && (!earliest || val < earliest)) {
      earliest = val;
    }
  }
  return earliest;
}

export async function getUserStats(): Promise<UserStats> {
  const users = await listAllUsers();

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.isActive).length;
  const inactiveUsers = totalUsers - activeUsers;
  const adminUsers = users.filter((u) => u.role === "admin").length;

  const totalEntries = users.reduce((sum, u) => sum + u.totalEntries, 0);
  const averageEntriesPerUser = totalUsers > 0
    ? Math.round((totalEntries / totalUsers) * 10) / 10
    : 0;

  const totalCompletion = users.reduce((sum, u) => sum + u.completionRate, 0);
  const averageCompletionRate = totalUsers > 0
    ? Math.round((totalCompletion / totalUsers) * 10) / 10
    : 0;

  return {
    totalUsers,
    activeUsers,
    inactiveUsers,
    adminUsers,
    averageEntriesPerUser,
    averageCompletionRate,
  };
}
