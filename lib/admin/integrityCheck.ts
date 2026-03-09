import "server-only";

/**
 * User integrity check orchestrator.
 *
 * Category checks live in ./integrityCheckCategory.ts
 * Index checks live in ./integrityCheckIndex.ts
 * WAL checks live in ./integrityCheckWal.ts
 */
import { CATEGORY_KEYS } from "@/lib/categories";
import { AppError } from "@/lib/errors";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { logger } from "@/lib/logger";
import type {
  CategoryDerivedStats,
  CategoryIntegrityReport,
  IntegrityIssue,
  IntegrityReport,
  IntegritySummary,
} from "./integrityTypes";
import { checkCategoryIntegrity } from "./integrityCheckCategory";
import { deriveExpectedStats, checkIndexIntegrity } from "./integrityCheckIndex";
import { checkWalIntegrity } from "./integrityCheckWal";

// Re-export for consumers that import from this module
export { readJsonFileDetailed } from "./integrityCheckCategory";

// ---------------------------------------------------------------------------
// checkUserIntegrityInternal
// ---------------------------------------------------------------------------

export async function checkUserIntegrityInternal(userEmail: string): Promise<IntegrityReport> {
  const normalizedUserEmail = normalizeEmail(userEmail);
  if (!normalizedUserEmail.endsWith("@tce.edu")) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Invalid user email for integrity checks.",
    });
  }
  const startedAt = Date.now();
  logger.debug({
    event: "admin.integrity.user.check.start",
    userEmail: normalizedUserEmail,
  });

  const perCategory = {} as Record<CategoryKey, CategoryIntegrityReport>;
  const categoryStats = {} as Record<CategoryKey, CategoryDerivedStats>;
  const allIssues = new Array<IntegrityIssue>();

  for (const category of CATEGORY_KEYS) {
    const { report, stats } = await checkCategoryIntegrity(normalizedUserEmail, category);
    perCategory[category] = report;
    categoryStats[category] = stats;
    allIssues.push(...report.issues);
  }

  const derived = deriveExpectedStats(categoryStats);
  const indexReport = await checkIndexIntegrity(normalizedUserEmail, derived);
  const walReport = await checkWalIntegrity(normalizedUserEmail);
  allIssues.push(...indexReport.issues, ...walReport.issues);

  const report = {
    userEmail: normalizedUserEmail,
    checkedAtISO: new Date().toISOString(),
    perCategory,
    indexReport,
    walReport,
    issues: allIssues,
  };
  logger.info({
    event: "admin.integrity.user.check.end",
    userEmail: normalizedUserEmail,
    count: report.issues.length,
    durationMs: Date.now() - startedAt,
  });
  return report;
}

// ---------------------------------------------------------------------------
// toSummary
// ---------------------------------------------------------------------------

export function toSummary(report: IntegrityReport): IntegritySummary {
  let infoCount = 0;
  let warnCount = 0;
  let errorCount = 0;
  let fixableCount = 0;

  for (const issue of report.issues) {
    if (issue.severity === "info") infoCount += 1;
    if (issue.severity === "warn") warnCount += 1;
    if (issue.severity === "error") errorCount += 1;
    if (issue.fixAvailable) fixableCount += 1;
  }

  return {
    userEmail: report.userEmail,
    totalIssues: report.issues.length,
    infoCount,
    warnCount,
    errorCount,
    fixableCount,
    checkFailed: false,
  };
}
