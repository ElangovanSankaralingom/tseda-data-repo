"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  ChevronRight,
  Download,
  FileEdit,
  ScrollText,
  Settings,
  Shield,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";

import { type HealthStatus, type DashboardData, type FeatureCard } from "./adminLocalTypes";

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
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
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
      className={`group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md animate-fade-in-up stagger-${Math.min(index + 1, 8)}`}
    >
      <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${card.accentBg} transition-transform duration-200 group-hover:scale-110`}>
        <Icon className={`size-6 ${card.accent}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-slate-900">{card.title}</span>
          {card.badge && card.badge > 0 ? (
            <span className={`flex size-5 items-center justify-center rounded-full text-xs font-bold text-white ${card.badgeColor ?? "bg-amber-500"} ${card.badgeColor === "bg-amber-500" ? "animate-subtle-pulse" : ""}`}>
              {card.badge}
            </span>
          ) : null}
          {card.badgeDot ? (
            <span className={`size-2.5 rounded-full ${card.badgeColor ?? "bg-red-500"} animate-subtle-pulse`} />
          ) : null}
        </div>
        <p className="mt-0.5 text-sm text-slate-500 line-clamp-1">{card.description}</p>
      </div>
      <ChevronRight className="mt-1 size-5 shrink-0 text-slate-400 transition-all duration-200 group-hover:translate-x-1 group-hover:text-slate-500" />
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

  // Feature cards — filtered by permissions, ordered by usage priority
  const featureCards = useMemo<FeatureCard[]>(() => {
    const cards: (FeatureCard | null)[] = [
      permissions.confirmations
        ? {
            title: "Edit Requests",
            description: "Review and grant edit access",
            href: "/admin/confirmations",
            icon: FileEdit,
            accent: "text-purple-600",
            accentBg: "bg-purple-100",
            badge: data?.metrics.pendingRequests,
            badgeColor: "bg-amber-500",
          }
        : null,
      permissions.users
        ? {
            title: "Users",
            description: "Profiles, roles, and activity",
            href: "/admin/users",
            icon: Users,
            accent: "text-blue-600",
            accentBg: "bg-blue-100",
            badge: data?.metrics.newUsersThisMonth || undefined,
            badgeColor: "bg-blue-500",
          }
        : null,
      permissions.analytics
        ? {
            title: "Analytics",
            description: "Charts, trends, and insights",
            href: "/admin/analytics",
            icon: BarChart3,
            accent: "text-emerald-600",
            accentBg: "bg-emerald-100",
          }
        : null,
      permissions.export
        ? {
            title: "Export",
            description: "Extract data in any format",
            href: "/admin/export",
            icon: Download,
            accent: "text-amber-600",
            accentBg: "bg-amber-100",
          }
        : null,
      permissions.backups
        ? {
            title: "Backup",
            description: "Create and restore backups",
            href: "/admin/backups",
            icon: Shield,
            accent: "text-indigo-600",
            accentBg: "bg-indigo-100",
            badgeDot: data?.health.backup.status === "red",
            badgeColor: "bg-red-500",
          }
        : null,
      permissions.integrity
        ? {
            title: "Integrity",
            description: "Scan and repair data health",
            href: "/admin/integrity",
            icon: ShieldCheck,
            accent: "text-emerald-600",
            accentBg: "bg-emerald-100",
            badgeDot: (data?.health.integrity.issues ?? 0) > 0,
            badgeColor: "bg-red-500",
          }
        : null,
      permissions.audit
        ? {
            title: "Audit Trail",
            description: "Full action traceability",
            href: "/admin/audit",
            icon: ScrollText,
            accent: "text-slate-600",
            accentBg: "bg-slate-100",
          }
        : null,
      permissions.maintenance
        ? {
            title: "Maintenance",
            description: "WAL, cleanup, and migrations",
            href: "/admin/maintenance",
            icon: Wrench,
            accent: "text-rose-600",
            accentBg: "bg-rose-100",
          }
        : null,
      permissions.settings
        ? {
            title: "Settings",
            description: "Configure app behavior",
            href: "/admin/settings",
            icon: Settings,
            accent: "text-slate-600",
            accentBg: "bg-slate-100",
            badgeDot: data?.health.system.maintenanceMode,
            badgeColor: "bg-amber-500",
          }
        : null,
    ];
    return cards.filter((c): c is FeatureCard => c !== null);
  }, [data, permissions]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 mb-8">
          <h1 className="text-2xl font-bold text-white">Admin Console</h1>
          <p className="mt-1 text-sm text-slate-300">Loading...</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-slate-200 bg-white animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-8">
          <h1 className="text-2xl font-bold text-white">Admin Console</h1>
          <p className="mt-2 text-sm text-red-300">Failed to load dashboard data. Please refresh.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      {/* ── Header ── */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 mb-8 animate-fade-in-up">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Console</h1>
            <p className="mt-1 text-sm text-slate-300">Manage, monitor, and maintain T&apos;SEDA</p>
          </div>

          {/* Health traffic lights */}
          <div className="flex items-center gap-5">
            <Link href="/admin/backups" className="flex flex-col items-center gap-1.5 group">
              <HealthDot status={data.health.backup.status} size="md" />
              <span className="text-xs text-slate-500 group-hover:text-slate-200 transition-colors">Backup</span>
            </Link>
            <Link href="/admin/integrity" className="flex flex-col items-center gap-1.5 group">
              <HealthDot status={data.health.integrity.status} size="md" />
              <span className="text-xs text-slate-500 group-hover:text-slate-200 transition-colors">Integrity</span>
            </Link>
            <Link href="/admin/settings" className="flex flex-col items-center gap-1.5 group">
              <HealthDot
                status={data.health.system.maintenanceMode ? "amber" : "green"}
                size="md"
              />
              <span className="text-xs text-slate-500 group-hover:text-slate-200 transition-colors">System</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Admin Tools ── */}
      <section>
        <SectionHeader title="Admin Tools" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featureCards.map((card, i) => (
            <FeatureCardItem key={card.title} card={card} index={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
