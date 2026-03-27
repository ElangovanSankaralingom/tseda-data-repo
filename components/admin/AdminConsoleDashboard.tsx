"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { type HealthStatus, type DashboardData, type FeatureCard } from "./adminLocalTypes";
import { adminBackups, adminIntegrity, adminSettings } from "@/lib/entryNavigation";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { ADMIN_TOOLS } from "@/data/adminToolRegistry";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HealthDot({ status, size = "sm" }: { status: HealthStatus; size?: "sm" | "md" }) {
  const sizeClass = size === "md" ? "size-3" : "size-2.5";
  const color =
    status === "green"
      ? "bg-emerald-500"
      : status === "amber"
        ? "bg-amber-500 animate-subtle-pulse"
        : "bg-red-500 animate-subtle-pulse";
  return <span className={`${sizeClass} rounded-full ${color} inline-block`} />;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h2>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feature Card (large, prominent — Section 1)
// ---------------------------------------------------------------------------

function FeatureCardItem({ card, index }: { card: FeatureCard; index: number }) {
  const Icon = card.icon;
  return (
    <Link
      href={card.href}
      className={`group flex items-start gap-4 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md animate-fade-in-up stagger-${Math.min(index + 1, 8)}`}
    >
      <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${card.accentBg} transition-transform duration-200 group-hover:scale-110`}>
        <Icon className={`size-6 ${card.accent}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-[var(--color-text-primary)]">{card.title}</span>
          {card.badge && card.badge > 0 ? (
            <span className={`flex size-5 items-center justify-center rounded-full text-xs font-bold text-white ${card.badgeColor ?? "bg-amber-500"} ${card.badgeColor === "bg-amber-500" ? "animate-subtle-pulse" : ""}`}>
              {card.badge}
            </span>
          ) : null}
          {card.badgeDot ? (
            <span className={`size-2.5 rounded-full ${card.badgeColor ?? "bg-red-500"} animate-subtle-pulse`} />
          ) : null}
        </div>
        <p className="mt-0.5 text-sm text-[var(--color-text-secondary)] line-clamp-1">{card.description}</p>
      </div>
      <ChevronRight className="mt-1 size-5 shrink-0 text-[var(--color-text-muted)] transition-all duration-200 group-hover:translate-x-1 group-hover:text-[var(--color-text-secondary)]" />
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function AdminConsoleDashboard({
  permissions,
}: {
  adminEmail: string;
  permissions: Record<string, boolean>;
}) {
  const { t } = useTranslation();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dashboard", { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as { data: DashboardData };
        setData(json.data);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Feature cards — registry-driven, filtered by permissions
  const featureCards = useMemo<FeatureCard[]>(() => {
    return ADMIN_TOOLS
      .filter((tool) => permissions[tool.id])
      .map((tool) => {
        const metrics = data?.metrics as Record<string, number> | undefined;
        const health = data?.health as Record<string, { status?: string; issues?: number; maintenanceMode?: boolean }> | undefined;

        let badge: number | undefined;
        let badgeDot: boolean | undefined;

        if (tool.badgeType === "count" && tool.metricKey && metrics) {
          const val = metrics[tool.metricKey];
          if (val && val > 0) badge = val;
        }
        if (tool.badgeType === "dot" && tool.healthKey && health) {
          const h = health[tool.healthKey];
          if (h) {
            if ("status" in h && h.status === "red") badgeDot = true;
            if ("issues" in h && (h.issues ?? 0) > 0) badgeDot = true;
            if ("maintenanceMode" in h && h.maintenanceMode) badgeDot = true;
          }
        }

        return {
          title: t(tool.titleKey),
          description: t(tool.descriptionKey),
          href: tool.href,
          icon: tool.icon,
          accent: tool.accentText,
          accentBg: tool.accentBg,
          badge,
          badgeDot,
          badgeColor: tool.badgeColor,
        };
      });
  }, [data, permissions, t]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="rounded-2xl bg-gradient-to-br from-[var(--color-gradient-from)] to-[var(--color-gradient-to)] p-8 mb-8">
          <h1 className="text-2xl font-bold text-white">{t("adminConsole.title")}</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Loading...</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="rounded-2xl bg-gradient-to-br from-[var(--color-gradient-from)] to-[var(--color-gradient-to)] p-8">
          <h1 className="text-2xl font-bold text-white">{t("adminConsole.title")}</h1>
          <p className="mt-2 text-sm text-red-300">Failed to load dashboard data. Please refresh.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      {/* ── Header ── */}
      <div className="rounded-2xl bg-gradient-to-br from-[var(--color-gradient-from)] to-[var(--color-gradient-to)] p-8 mb-8 animate-fade-in-up">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{t("adminConsole.title")}</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t("adminConsole.subtitle")}</p>
          </div>

          {/* Health traffic lights */}
          <div className="flex items-center gap-5">
            <Link href={adminBackups()} className="flex flex-col items-center gap-1.5 group">
              <HealthDot status={data.health.backup.status} size="md" />
              <span className="text-xs text-[var(--color-text-muted)] group-hover:text-[var(--color-text-muted)] transition-colors">{t("adminConsole.backup")}</span>
            </Link>
            <Link href={adminIntegrity()} className="flex flex-col items-center gap-1.5 group">
              <HealthDot status={data.health.integrity.status} size="md" />
              <span className="text-xs text-[var(--color-text-muted)] group-hover:text-[var(--color-text-muted)] transition-colors">{t("adminConsole.integrity")}</span>
            </Link>
            <Link href={adminSettings()} className="flex flex-col items-center gap-1.5 group">
              <HealthDot
                status={data.health.system.maintenanceMode ? "amber" : "green"}
                size="md"
              />
              <span className="text-xs text-[var(--color-text-muted)] group-hover:text-[var(--color-text-muted)] transition-colors">System</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Admin Tools ── */}
      <section>
        <SectionHeader title={t("adminConsole.adminTools")} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featureCards.map((card, i) => (
            <FeatureCardItem key={card.title} card={card} index={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
