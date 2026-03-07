import Link from "next/link";
import { getServerSession } from "next-auth";
import { ChevronRight } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getPendingConfirmationsCount } from "@/lib/admin/pendingConfirmations";
import {
  canAccessAdminSearch,
  canAccessSettings,
  canApproveConfirmations,
  canExport,
  canManageAdminUsers,
  canManageBackups,
  canRunIntegrityTools,
  canRunMaintenance,
  canViewAnalytics,
  canViewAudit,
} from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import {
  adminAnalytics,
  adminAudit,
  adminBackups,
  adminConfirmations,
  adminExport,
  adminSearch,
  adminSettings,
  adminMaintenance,
  adminIntegrity,
  adminUsers,
  dashboard,
} from "@/lib/entryNavigation";
import { trackEvent } from "@/lib/telemetry/telemetry";

type AdminCard = {
  title: string;
  href: string;
  description: string;
};

function getAdminCards(email: string): AdminCard[] {
  const cards: Array<AdminCard | null> = [
    canApproveConfirmations(email)
      ? {
          title: "Confirmations",
          href: adminConfirmations(),
          description: "Review pending entry confirmations and approve or reject requests.",
        }
      : null,
    canManageAdminUsers(email)
      ? {
          title: "Users",
          href: adminUsers(),
          description: "Manage admin role assignments and account controls.",
        }
      : null,
    canAccessSettings(email)
      ? {
          title: "Settings",
          href: adminSettings(),
          description: "Configure admin-level settings for the data-entry workflow.",
        }
      : null,
    canViewAudit(email)
      ? {
          title: "Audit",
          href: adminAudit(),
          description: "Inspect approval/rejection audit history across all users and categories.",
        }
      : null,
    canViewAnalytics(email)
      ? {
          title: "Analytics",
          href: adminAnalytics(),
          description: "Review usage, funnel drop-offs, failures, and workflow turnaround metrics.",
        }
      : null,
    canAccessAdminSearch(email)
      ? {
          title: "Search",
          href: adminSearch(),
          description: "Search entries across all users and categories using indexed snapshots.",
        }
      : null,
    canExport(email)
      ? {
          title: "Export",
          href: adminExport(),
          description: "Export normalized entry data to Excel or CSV using schema-driven columns.",
        }
      : null,
    canRunIntegrityTools(email)
      ? {
          title: "Integrity",
          href: adminIntegrity(),
          description: "Run integrity checks and repair category stores, index, and migration drift.",
        }
      : null,
    canManageBackups(email)
      ? {
          title: "Backups",
          href: adminBackups(),
          description: "Create, download, and retain secure zipped backups of the .data store.",
        }
      : null,
    canRunMaintenance(email)
      ? {
          title: "Maintenance",
          href: adminMaintenance(),
          description: "Run nightly maintenance jobs now and monitor recent job outcomes.",
        }
      : null,
  ];

  return cards.filter((card): card is AdminCard => card !== null);
}

export default async function AdminConsolePage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  void trackEvent({
    event: "page.admin_console_view",
    actorEmail: email,
    role: "admin",
    meta: {
      page: "/admin",
    },
  });
  const cards = getAdminCards(email);
  const pendingCount = await getPendingConfirmationsCount();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      {/* Gradient Header */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 mb-8">
        <h1 className="text-2xl font-bold text-white">Admin Console</h1>
        <p className="mt-1 text-sm text-slate-300">Master-admin controls for confirmations and system management.</p>
        {pendingCount > 0 && (
          <div className="mt-4">
            <span className="rounded-full bg-amber-500 px-3 py-1 text-sm font-medium text-white">
              {pendingCount} pending {pendingCount === 1 ? "request" : "requests"}
            </span>
          </div>
        )}
      </div>

      {/* Navigation Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="text-lg font-semibold text-slate-900 tracking-tight">{card.title}</div>
                {card.href === adminConfirmations() && pendingCount > 0 ? (
                  <span className="flex size-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                    {pendingCount}
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 text-sm text-slate-500">{card.description}</p>
            </div>
            <ChevronRight className="mt-1 size-5 shrink-0 text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-slate-500" />
          </Link>
        ))}
      </div>
    </div>
  );
}
