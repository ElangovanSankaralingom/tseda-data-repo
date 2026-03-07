import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getCategoryConfig } from "@/data/categoryRegistry";
import { authOptions } from "@/lib/auth";
import { CATEGORY_KEYS } from "@/lib/categories";
import { readCategoryEntries } from "@/lib/dataStore";
import type { CategoryKey } from "@/lib/entries/types";
import {
  normalizeEntryStatus,
  type EntryStateLike,
} from "@/lib/entries/workflow";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { entryDetail, entryList } from "@/lib/entryNavigation";
import { getProfileByEmail } from "@/lib/profileStore";
import { buildSearchText } from "@/lib/search/searchText";
import { getEntryTitle } from "@/lib/search/getEntryTitle";
import { listUsers } from "@/lib/admin/integrity";
import { canAccessAdminConsole } from "@/lib/admin/roles";
import type { Entry } from "@/lib/types/entry";
import type {
  SearchableItem,
  SearchableEntry,
  SearchableUser,
  SearchableCategory,
  SearchablePage,
} from "@/lib/search/engine";

function toISO(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  return "";
}

const USER_PAGES: SearchablePage[] = [
  { type: "page", id: "p-dashboard", name: "Dashboard", path: "/dashboard", description: "Your progress overview", adminOnly: false },
  { type: "page", id: "p-data-entry", name: "Data Entry", path: "/data-entry", description: "Create and manage entries", adminOnly: false },
  { type: "page", id: "p-account", name: "My Account", path: "/account", description: "Profile and settings", adminOnly: false },
];

const ADMIN_PAGES: SearchablePage[] = [
  { type: "page", id: "p-admin", name: "Admin Console", path: "/admin", description: "Administration dashboard", adminOnly: true },
  { type: "page", id: "p-analytics", name: "Analytics", path: "/admin/analytics", description: "Usage charts and insights", adminOnly: true },
  { type: "page", id: "p-export", name: "Export Center", path: "/admin/export", description: "Export entry data", adminOnly: true },
  { type: "page", id: "p-integrity", name: "Data Integrity", path: "/admin/integrity", description: "Run integrity checks", adminOnly: true },
  { type: "page", id: "p-audit", name: "Audit Log", path: "/admin/audit", description: "View approval history", adminOnly: true },
  { type: "page", id: "p-confirmations", name: "Confirmations", path: "/admin/confirmations", description: "Review pending requests", adminOnly: true },
  { type: "page", id: "p-backups", name: "Backups", path: "/admin/backups", description: "Manage data backups", adminOnly: true },
];

async function buildUserEntries(email: string): Promise<SearchableEntry[]> {
  const items: SearchableEntry[] = [];
  for (const category of CATEGORY_KEYS) {
    const entries = await readCategoryEntries(email, category);
    const config = getCategoryConfig(category);
    for (const entry of entries) {
      const status = normalizeEntryStatus(entry as unknown as EntryStateLike);
      items.push({
        type: "entry",
        id: `${category}:${entry.id ?? ""}`,
        email,
        category,
        categoryLabel: config.label,
        status,
        title: getEntryTitle(entry as Entry, category as CategoryKey),
        content: buildSearchText(entry as Entry, category as CategoryKey),
        streakEligible: entry.streakEligible === true,
        createdAt: toISO(entry.createdAt),
        updatedAt: toISO(entry.updatedAt),
        href: entryDetail(category as CategoryKey, String(entry.id ?? "")),
      });
    }
  }
  return items;
}

function buildCategoryItems(entryCounts: Record<string, number>): SearchableCategory[] {
  return CATEGORY_KEYS.map((key) => {
    const config = getCategoryConfig(key);
    return {
      type: "category",
      id: `cat-${key}`,
      slug: key,
      name: config.label,
      entryCount: entryCounts[key] ?? 0,
      href: entryList(key),
    };
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = canAccessAdminConsole(email);
  const items: SearchableItem[] = [];

  if (isAdmin) {
    // Index all users' entries
    const usersResult = await listUsers();
    const allEmails = usersResult.ok ? usersResult.data : [email];
    const entryCounts: Record<string, number> = {};

    for (const userEmail of allEmails) {
      const userEntries = await buildUserEntries(userEmail);
      items.push(...userEntries);
      for (const e of userEntries) {
        entryCounts[e.category] = (entryCounts[e.category] ?? 0) + 1;
      }

      // Add user item
      const profile = await getProfileByEmail(userEmail);
      const displayName =
        profile?.userPreferredName ||
        profile?.googleDisplayName ||
        userEmail.split("@")[0];
      items.push({
        type: "user",
        id: `user-${userEmail}`,
        email: userEmail,
        name: displayName,
        entryCount: userEntries.length,
        streakWins: 0,
        href: `/admin/integrity/${encodeURIComponent(userEmail)}`,
      } satisfies SearchableUser);
    }

    items.push(...buildCategoryItems(entryCounts));
    items.push(...USER_PAGES, ...ADMIN_PAGES);
  } else {
    // User scope — own entries only
    const userEntries = await buildUserEntries(email);
    items.push(...userEntries);
    const entryCounts: Record<string, number> = {};
    for (const e of userEntries) {
      entryCounts[e.category] = (entryCounts[e.category] ?? 0) + 1;
    }
    items.push(...buildCategoryItems(entryCounts));
    items.push(...USER_PAGES);
  }

  return NextResponse.json({ data: items });
}
