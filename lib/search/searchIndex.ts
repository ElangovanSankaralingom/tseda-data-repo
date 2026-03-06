import "server-only";

import fs from "node:fs/promises";
import { getCategoryConfig } from "@/data/categoryRegistry";
import { ensureUserIndex } from "@/lib/data/indexStore";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { entryDetail } from "@/lib/navigation";
import { err, ok, type Result } from "@/lib/result";
import { getUsersRootDir } from "@/lib/userStore";
import type { EntryStatus } from "@/lib/types/entry";
import { trackEvent } from "@/lib/telemetry/telemetry";
import {
  buildSearchText,
  normalizeSearchText,
  type SearchSnapshot,
} from "@/lib/search/searchText";
import { normalizeError } from "@/lib/errors";

type SearchIndexEntry = SearchSnapshot;

export type SearchResult = {
  userEmail?: string;
  entryId: string;
  category: CategoryKey;
  categoryLabel: string;
  title: string;
  status: EntryStatus;
  updatedAt: string | null;
  score: number;
  href: string;
};

type SearchOptions = {
  category?: CategoryKey | "all";
  limit?: number;
  userEmail?: string;
  actorEmail?: string;
};

type IndexedUserSearch = {
  userEmail: string;
  entries: SearchIndexEntry[];
};

function toSafeLimit(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 100;
  if (value <= 0) return 20;
  return Math.min(Math.floor(value), 500);
}

function toSortTime(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function tokenize(query: string) {
  return Array.from(new Set(normalizeSearchText(query).split(" ").filter(Boolean)));
}

function hasAllTokens(text: string, tokens: string[]) {
  return tokens.every((token) => text.includes(token));
}

function scoreEntry(entry: SearchIndexEntry, query: string, tokens: string[]) {
  const normalizedTitle = normalizeSearchText(entry.title);
  let score = 0;
  if (normalizedTitle.includes(query)) score += 90;
  if (entry.text.includes(query)) score += 30;

  for (const token of tokens) {
    if (normalizedTitle.includes(token)) {
      score += 15;
      continue;
    }
    if (entry.text.includes(token)) {
      score += 5;
    }
  }

  return score;
}

function toSearchEntries(index: { searchIndexByEntryId?: unknown }): SearchIndexEntry[] {
  const snapshots = index.searchIndexByEntryId;
  if (!snapshots || typeof snapshots !== "object" || Array.isArray(snapshots)) {
    return [];
  }

  const entries: SearchIndexEntry[] = [];
  for (const value of Object.values(snapshots as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const record = value as Record<string, unknown>;
    const entryId = String(record.entryId ?? "").trim();
    const category = String(record.categoryKey ?? "").trim() as CategoryKey;
    const title = String(record.title ?? "").trim();
    const text = normalizeSearchText(String(record.text ?? ""));
    const status = String(record.status ?? "").trim() as EntryStatus;
    const updatedAtISO = typeof record.updatedAtISO === "string" ? record.updatedAtISO.trim() : "";
    const createdAtISO = typeof record.createdAtISO === "string" ? record.createdAtISO.trim() : "";
    if (!entryId || !category || !title || !text || !status) continue;

    entries.push({
      entryId,
      categoryKey: category,
      title,
      text,
      status,
      updatedAtISO: updatedAtISO || null,
      createdAtISO: createdAtISO || null,
    });
  }

  return entries;
}

async function trackSearchTelemetry(args: {
  actorEmail: string;
  role: "user" | "admin";
  category: CategoryKey | "all" | null;
  success: boolean;
  durationMs: number;
  resultCount?: number;
  queryLength: number;
  scope: "user" | "admin";
  errorCode?: string;
  ownerFilter?: string;
}) {
  const tracked = await trackEvent({
    event: "entry.search",
    actorEmail: args.actorEmail,
    role: args.role,
    category: args.category && args.category !== "all" ? args.category : null,
    success: args.success,
    durationMs: args.durationMs,
    meta: {
      action: "entry.search",
      scope: args.scope,
      queryLength: args.queryLength,
      resultCount: args.resultCount ?? null,
      ownerFilter: args.ownerFilter || null,
      errorCode: args.errorCode ?? null,
    },
  });
  if (!tracked.ok) {
    // Telemetry should not affect search results.
  }
}

async function loadUserSearchEntries(userEmail: string): Promise<Result<IndexedUserSearch>> {
  const normalized = normalizeEmail(userEmail);
  if (!normalized) {
    return err(normalizeError(new Error("Invalid email")));
  }

  const ensured = await ensureUserIndex(normalized);
  if (!ensured.ok) return err(ensured.error);

  return ok({
    userEmail: normalized,
    entries: toSearchEntries(ensured.data),
  });
}

function toSearchResults(
  indexed: IndexedUserSearch,
  queryNormalized: string,
  tokens: string[],
  options: SearchOptions
) {
  const limit = toSafeLimit(options.limit);
  const categoryFilter = options.category && options.category !== "all" ? options.category : null;

  const matched = indexed.entries
    .filter((entry) => {
      if (categoryFilter && entry.categoryKey !== categoryFilter) return false;
      return hasAllTokens(entry.text, tokens);
    })
    .map((entry) => {
      const score = scoreEntry(entry, queryNormalized, tokens);
      const categoryConfig = getCategoryConfig(entry.categoryKey);
      return {
        userEmail: indexed.userEmail,
        entryId: entry.entryId,
        category: entry.categoryKey,
        categoryLabel: categoryConfig.label,
        title: entry.title,
        status: entry.status,
        updatedAt: entry.updatedAtISO ?? entry.createdAtISO,
        score,
        href: entryDetail(entry.categoryKey, entry.entryId),
      } satisfies SearchResult;
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return toSortTime(right.updatedAt) - toSortTime(left.updatedAt);
    });

  return matched.slice(0, limit);
}

export async function searchUserEntries(
  userEmail: string,
  query: string,
  options: SearchOptions = {}
): Promise<Result<SearchResult[]>> {
  const startedAt = Date.now();
  const actorEmail = normalizeEmail(userEmail) || "unknown";
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return ok([]);

  const tokens = tokenize(normalizedQuery);
  if (!tokens.length) return ok([]);

  const indexed = await loadUserSearchEntries(userEmail);
  if (!indexed.ok) {
    await trackSearchTelemetry({
      actorEmail,
      role: "user",
      category: options.category ?? null,
      success: false,
      durationMs: Date.now() - startedAt,
      queryLength: normalizedQuery.length,
      scope: "user",
      errorCode: indexed.error.code,
    });
    return err(indexed.error);
  }

  const results = toSearchResults(indexed.data, normalizedQuery, tokens, options);
  await trackSearchTelemetry({
    actorEmail,
    role: "user",
    category: options.category ?? null,
    success: true,
    durationMs: Date.now() - startedAt,
    resultCount: results.length,
    queryLength: normalizedQuery.length,
    scope: "user",
  });

  return ok(results);
}

export async function searchAllUsers(
  query: string,
  options: SearchOptions = {}
): Promise<Result<SearchResult[]>> {
  const startedAt = Date.now();
  const actorEmail = normalizeEmail(options.actorEmail ?? "") || "unknown";
  try {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return ok([]);
    const tokens = tokenize(normalizedQuery);
    if (!tokens.length) return ok([]);

    const usersRoot = getUsersRootDir();
    const dirEntries = await fs.readdir(usersRoot, { withFileTypes: true });
    const ownerFilter = options.userEmail ? normalizeEmail(options.userEmail) : "";
    const limit = toSafeLimit(options.limit);
    const results: SearchResult[] = [];

    for (const dirEntry of dirEntries) {
      if (!dirEntry.isDirectory()) continue;
      const userEmail = normalizeEmail(dirEntry.name);
      if (!userEmail) continue;
      if (ownerFilter && ownerFilter !== userEmail) continue;

      const indexed = await loadUserSearchEntries(userEmail);
      if (!indexed.ok) continue;
      const matched = toSearchResults(indexed.data, normalizedQuery, tokens, {
        ...options,
        limit,
      });
      results.push(...matched);
    }

    results.sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return toSortTime(right.updatedAt) - toSortTime(left.updatedAt);
    });
    const finalResults = results.slice(0, limit);
    await trackSearchTelemetry({
      actorEmail,
      role: "admin",
      category: options.category ?? null,
      success: true,
      durationMs: Date.now() - startedAt,
      resultCount: finalResults.length,
      queryLength: normalizedQuery.length,
      scope: "admin",
      ownerFilter,
    });

    return ok(finalResults);
  } catch (error) {
    const normalized = normalizeError(error);
    await trackSearchTelemetry({
      actorEmail,
      role: "admin",
      category: options.category ?? null,
      success: false,
      durationMs: Date.now() - startedAt,
      queryLength: normalizeSearchText(query).length,
      scope: "admin",
      errorCode: normalized.code,
      ownerFilter: options.userEmail ?? "",
    });
    return err(normalized);
  }
}

export { buildSearchText };
