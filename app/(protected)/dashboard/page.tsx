import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import {
  ClipboardList,
  ArrowUpRight,
} from "lucide-react";
import DashboardClient from "@/components/dashboard/DashboardClient";
import { canAccessAdminConsole } from "@/lib/admin/roles";
import { authOptions } from "@/lib/auth";
import { CATEGORY_KEYS } from "@/lib/categories";
import { getDashboardSummary } from "@/lib/entries/summary";
import { normalizeEmail } from "@/lib/facultyDirectory";
import {
  dataEntryHome,
  signin,
} from "@/lib/entryNavigation";
import { trackEvent } from "@/lib/telemetry/telemetry";
import { ALLOWED_EMAIL_SUFFIX } from "@/lib/config/appConfig";
import DashboardWelcome from "@/components/dashboard/DashboardWelcome";

export const dynamic = "force-dynamic";

function toSafeCount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");

  if (!email.endsWith(ALLOWED_EMAIL_SUFFIX)) {
    redirect(signin());
  }

  const canAccessAdmin = canAccessAdminConsole(email);
  void trackEvent({
    event: "page.dashboard_view",
    actorEmail: email,
    role: canAccessAdmin ? "admin" : "user",
    meta: { page: "/dashboard" },
  });

  const summary = await getDashboardSummary(email);
  const userName = session?.user?.name?.trim() || email;

  const streakActivated = toSafeCount(summary.totals.streakActivatedCount);
  const streakWins = toSafeCount(summary.totals.streakWinsCount);
  const totalEntries = toSafeCount(summary.totals.totalEntries);
  const editRequestedCount = toSafeCount(summary.totals.editRequestedCount);
  const draftCount = toSafeCount(summary.totals.draftCount);

  const hasAnyEntries = totalEntries > 0;
  const firstName = userName.split(/\s+/)[0] ?? userName;

  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? "greetingMorning" : hour < 17 ? "greetingAfternoon" : "greetingEvening";

  // Build per-category summaries for the bento grid
  const categories = CATEGORY_KEYS.map((slug) => {
    const cat = summary.byCategory[slug];
    return {
      slug,
      totalEntries: toSafeCount(cat?.totalEntries ?? 0),
      draftCount: toSafeCount(cat?.draftCount ?? 0),
      generatedCount: toSafeCount(cat?.generatedCount ?? 0),
      editRequestedCount: toSafeCount(cat?.editRequestedCount ?? 0),
      editGrantedCount: toSafeCount(cat?.editGrantedCount ?? 0),
    };
  });

  // Recent entries for the activity sidebar
  const recentEntries = (summary.recentEntries ?? []).slice(0, 6).map((row) => ({
    id: row.id,
    categoryKey: row.categoryKey,
    categoryLabel: row.categoryLabel,
    title: row.title,
    status: String(row.status),
    updatedAtISO: row.updatedAtISO,
    route: row.route,
  }));

  return (
    <div className="relative space-y-8 animate-page-enter dot-grid-bg">
      {/* ── Command Strip — dark hero bar ── */}
      <DashboardWelcome
        greetingKey={greetingKey}
        firstName={firstName}
        totalEntries={totalEntries}
        streakActivated={streakActivated}
        streakWins={streakWins}
        hasAnyEntries={hasAnyEntries}
        draftCount={draftCount}
        editRequestedCount={editRequestedCount}
      />

      {/* ── Content: Empty state or Bento grid ── */}
      {!hasAnyEntries ? (
        <DashboardEmptyState />
      ) : (
        <DashboardClient
          categories={categories}
          recentEntries={recentEntries}
        />
      )}
    </div>
  );
}

function DashboardEmptyState() {
  return (
    <div className="flex overflow-hidden rounded-2xl border border-dashed border-[rgba(255,255,255,0.06)] bg-[rgba(0,0,0,0.25)] animate-card-lift">
      {/* ── Thick left accent bar ── */}
      <div className="w-1.5 shrink-0 bg-[var(--color-primary)] opacity-25" />

      <div className="flex-1 p-8 sm:p-10">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          {/* ── Left: Bright icon panel (white surface pop) ── */}
          <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-[rgba(255,255,255,0.07)] border border-[rgba(255,255,255,0.1)]">
            <ClipboardList className="size-9 text-[rgba(255,255,255,0.25)]" />
          </div>

          {/* ── Right: Text + CTA ── */}
          <div>
            <p className="text-base font-bold text-[rgba(255,255,255,0.6)]">
              No entries yet
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[rgba(255,255,255,0.2)]">
              Start collecting data to build your streak
            </p>
            <Link
              href={dataEntryHome()}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--color-button-primary-bg)] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--color-button-primary-text)] transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.97]"
            >
              Go to Data Entry
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
