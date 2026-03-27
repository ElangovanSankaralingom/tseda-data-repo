import "server-only";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { CATEGORY_LIST, getCategoryConfig } from "@/data/categoryRegistry";
import { authOptions } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/dashboard/getDashboardSummary";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { entryList, entryNew } from "@/lib/entryNavigation";
import { apiUnauthorized } from "@/lib/api/apiResponse";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { normalizeError } from "@/lib/errors";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email) {
    return apiUnauthorized();
  }

  try {
    enforceRateLimitForRequest({
      request,
      userEmail: email,
      action: "me.data-entry-overview.get",
      options: RATE_LIMIT_PRESETS.entryReads,
    });
  } catch (error) {
    const appError = normalizeError(error);
    if (appError.code === "RATE_LIMITED") {
      return NextResponse.json({ error: appError.message, code: appError.code }, { status: 429 });
    }
    throw error;
  }

  const summary = await getDashboardSummary(email);

  // Derive last activity per category from recent entries
  const lastActivityMap: Record<string, string | null> = {};
  for (const entry of summary.recentEntries) {
    if (!lastActivityMap[entry.categoryKey] && entry.updatedAtISO) {
      lastActivityMap[entry.categoryKey] = entry.updatedAtISO;
    }
  }

  const categories = CATEGORY_LIST.map((slug) => {
    const config = getCategoryConfig(slug);
    const catData = summary.byCategory[slug];
    return {
      slug,
      label: config.label,
      subtitle: config.subtitle ?? "",
      href: entryList(slug),
      newHref: entryNew(slug),
      totalEntries: catData.totalEntries,
      draftCount: catData.draftCount,
      generatedCount: catData.generatedCount,
      editRequestedCount: catData.editRequestedCount,
      editGrantedCount: catData.editGrantedCount,
      streakActivated: catData.streakActivatedCount,
      streakWins: catData.streakWinsCount,
      lastActivity: lastActivityMap[slug] ?? null,
    };
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return NextResponse.json({
    data: {
      greeting,
      userName: session?.user?.name ?? null,
      categories,
      totals: {
        totalEntries: summary.totals.totalEntries,
        draftCount: summary.totals.draftCount,
        generatedCount: summary.totals.generatedCount,
        editRequestedCount: summary.totals.editRequestedCount,
        editGrantedCount: summary.totals.editGrantedCount,
        streakActivatedCount: summary.totals.streakActivatedCount,
        streakWinsCount: summary.totals.streakWinsCount,
      },
    },
  }, {
    headers: {
      "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
    },
  });
}
