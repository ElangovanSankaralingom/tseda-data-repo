import Link from "next/link";
import BackTo from "@/components/nav/BackTo";
import { getPendingConfirmationsCount } from "@/lib/admin/pendingConfirmations";
import {
  adminAudit,
  adminConfirmations,
  adminSettings,
  adminUsers,
  dashboard,
} from "@/lib/navigation";

type AdminCard = {
  title: string;
  href: string;
  description: string;
};

const ADMIN_CARDS: AdminCard[] = [
  {
    title: "Confirmations",
    href: adminConfirmations(),
    description: "Review pending entry confirmations and approve or reject requests.",
  },
  {
    title: "Users",
    href: adminUsers(),
    description: "Manage user-level admin tools and account controls.",
  },
  {
    title: "Settings",
    href: adminSettings(),
    description: "Configure admin-level settings for the data-entry workflow.",
  },
  {
    title: "Audit",
    href: adminAudit(),
    description: "Inspect approval/rejection audit history across all users and categories.",
  },
];

export default async function AdminConsolePage() {
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
        {ADMIN_CARDS.map((card) => (
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
