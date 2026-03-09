import "server-only";
import { CATEGORY_KEYS } from "@/lib/categories";
import type { CategoryKey } from "@/lib/entries/types";
import { AppError, normalizeError } from "@/lib/errors";
import { err, ok, type Result } from "@/lib/result";
import { createEntryStatusRecord, ENTRY_STATUSES } from "@/lib/types/entry";
import type { UserIndex } from "@/lib/data/indexStore";
import {
  USER_INDEX_SCHEMA_VERSION,
  isRecord,
  toVersion,
  toTrimmedString,
  toISO,
  toOptionalISO,
  toNonNegativeInteger,
  emptyCategoryMap,
  runRecordMigrations,
  normalizeIndexSearchMap,
} from "./migrationHelpers";

function migrateUserIndexV0ToV1(raw: Record<string, unknown>, nowISO: string) {
  const userEmail = toTrimmedString(raw.userEmail);
  const next: UserIndex = {
    version: USER_INDEX_SCHEMA_VERSION,
    userEmail,
    updatedAt: toISO(raw.updatedAt, nowISO),
    totalsByCategory: emptyCategoryMap(() => 0),
    countsByStatus: createEntryStatusRecord(() => 0),
    pendingByCategory: emptyCategoryMap(() => 0),
    approvedByCategory: emptyCategoryMap(() => 0),
    lastEntryAtByCategory: emptyCategoryMap(() => null),
    streakSnapshot: {
      ruleVersion: 0,
      streakActivatedCount: 0,
      streakWinsCount: 0,
      byCategory: emptyCategoryMap(() => ({ activated: 0, wins: 0 })),
      activeEntries: [],
      lastComputedAt: nowISO,
    },
    searchIndexByEntryId: {},
  };

  const totalsByCategory = isRecord(raw.totalsByCategory) ? raw.totalsByCategory : null;
  const pendingByCategory = isRecord(raw.pendingByCategory) ? raw.pendingByCategory : null;
  const approvedByCategory = isRecord(raw.approvedByCategory) ? raw.approvedByCategory : null;
  const lastEntryAtByCategory = isRecord(raw.lastEntryAtByCategory) ? raw.lastEntryAtByCategory : null;
  const countsByStatus = isRecord(raw.countsByStatus) ? raw.countsByStatus : null;
  const streakSnapshot = isRecord(raw.streakSnapshot) ? raw.streakSnapshot : null;
  const streakByCategory = streakSnapshot && isRecord(streakSnapshot.byCategory) ? streakSnapshot.byCategory : null;
  const activeEntriesRaw =
    streakSnapshot && Array.isArray(streakSnapshot.activeEntries) ? streakSnapshot.activeEntries : [];

  for (const category of CATEGORY_KEYS) {
    next.totalsByCategory[category] = toNonNegativeInteger(totalsByCategory?.[category]);
    next.pendingByCategory[category] = toNonNegativeInteger(pendingByCategory?.[category]);
    next.approvedByCategory[category] = toNonNegativeInteger(approvedByCategory?.[category]);
    next.lastEntryAtByCategory[category] = toOptionalISO(lastEntryAtByCategory?.[category]);

    const streakCategoryRaw = isRecord(streakByCategory?.[category]) ? streakByCategory[category] : {};
    next.streakSnapshot.byCategory[category] = {
      activated: toNonNegativeInteger(streakCategoryRaw.activated),
      wins: toNonNegativeInteger(streakCategoryRaw.wins),
    };
  }

  for (const status of ENTRY_STATUSES) {
    next.countsByStatus[status] = toNonNegativeInteger(countsByStatus?.[status]);
  }

  next.streakSnapshot.ruleVersion = toVersion(streakSnapshot?.ruleVersion, 0);
  next.streakSnapshot.streakActivatedCount = toNonNegativeInteger(streakSnapshot?.streakActivatedCount);
  next.streakSnapshot.streakWinsCount = toNonNegativeInteger(streakSnapshot?.streakWinsCount);
  next.streakSnapshot.lastComputedAt = toISO(streakSnapshot?.lastComputedAt, nowISO);
  next.streakSnapshot.activeEntries = activeEntriesRaw
    .map((value) => {
      if (!isRecord(value)) return null;
      const id = toTrimmedString(value.id);
      const categoryKey = toTrimmedString(value.categoryKey) as CategoryKey;
      if (!id || !CATEGORY_KEYS.includes(categoryKey)) return null;
      return {
        id,
        categoryKey,
        dueAtISO: toOptionalISO(value.dueAtISO),
        sortAtISO: toOptionalISO(value.sortAtISO),
      };
    })
    .filter((value): value is UserIndex["streakSnapshot"]["activeEntries"][number] => !!value)
    .sort((left, right) => {
      const leftTime = Date.parse(left.sortAtISO ?? "");
      const rightTime = Date.parse(right.sortAtISO ?? "");
      const safeLeft = Number.isNaN(leftTime) ? Number.POSITIVE_INFINITY : leftTime;
      const safeRight = Number.isNaN(rightTime) ? Number.POSITIVE_INFINITY : rightTime;
      return safeLeft - safeRight;
    });
  next.searchIndexByEntryId = normalizeIndexSearchMap(raw.searchIndexByEntryId);

  return next as unknown as Record<string, unknown>;
}

function migrateUserIndexV1ToV2(raw: Record<string, unknown>, nowISO: string) {
  const next = migrateUserIndexV0ToV1(raw, nowISO) as Record<string, unknown>;
  next.searchIndexByEntryId = normalizeIndexSearchMap(raw.searchIndexByEntryId);
  return next;
}

export function migrateUserIndex(raw: unknown): Result<UserIndex> {
  try {
    if (!isRecord(raw)) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Invalid user index payload",
      });
    }

    const nowISO = new Date().toISOString();
    const rawVersion = toVersion(raw.version, 0);
    const migrated = runRecordMigrations(
      raw,
      rawVersion,
      USER_INDEX_SCHEMA_VERSION,
      {
        0: migrateUserIndexV0ToV1,
        1: migrateUserIndexV1ToV2,
      },
      nowISO
    );

    const finalized = migrateUserIndexV1ToV2(
      migrateUserIndexV0ToV1(migrated, nowISO),
      nowISO
    ) as unknown as UserIndex;
    finalized.version = USER_INDEX_SCHEMA_VERSION;
    finalized.updatedAt = toISO(finalized.updatedAt, nowISO);
    finalized.userEmail = toTrimmedString(finalized.userEmail);

    return ok(finalized);
  } catch (error) {
    return err(normalizeError(error));
  }
}
