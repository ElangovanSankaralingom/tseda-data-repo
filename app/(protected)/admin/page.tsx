import Link from "next/link";
import { getServerSession } from "next-auth";
import BackTo from "@/components/nav/BackTo";
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
      <div className="mb-6 flex items-center gap-3">
        <BackTo href={dashboard()} compact />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin Console</h1>
          <p className="mt-1 text-sm text-muted-foreground">Master-admin controls for confirmations and system management.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-2xl border border-border bg-card p-5 transition hover:border-foreground/30 hover:bg-muted/20"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-lg font-semibold tracking-tight">{card.title}</div>
              {card.href === adminConfirmations() ? (
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {pendingCount}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
