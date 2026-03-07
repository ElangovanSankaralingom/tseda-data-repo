"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import AvatarMenu from "@/components/AvatarMenu";
import { Button } from "@/components/ui/button";
import { isMasterAdmin } from "@/lib/admin";
import {
  adminHome,
  dashboard,
  dataEntryHome,
  dataEntrySearch,
  profile,
  signin,
} from "@/lib/entryNavigation";
import Toast from "@/components/ui/Toast";
import { safeAction } from "@/lib/safeAction";
import { notifyError, notifySuccess } from "@/lib/ui/notify";

const ENABLE_RESET = true;

type NavLink = {
  href: string;
  label: string;
};

export default function ShellClient({
  children,
  title = "T'SEDA Data Repository",
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [canAccessAdmin, setCanAccessAdmin] = useState(() =>
    isMasterAdmin(session?.user?.email)
  );
  const [open, setOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(0);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  const primaryNav: NavLink[] = [
    { href: dashboard(), label: "Dashboard" },
    { href: dataEntryHome(), label: "Data Entry" },
    { href: dataEntrySearch(), label: "Search" },
    { href: profile(), label: "My Account" },
  ];
  const drawerNav: NavLink[] = canAccessAdmin
    ? [...primaryNav, { href: adminHome(), label: "Admin Console" }]
    : primaryNav;

  useEffect(() => {
    const email = session?.user?.email ?? "";
    const masterFallback = isMasterAdmin(email);
    setCanAccessAdmin(masterFallback);

    if (!email) return;

    let cancelled = false;
    void fetch("/api/me/admin-capabilities", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as {
          canAccessAdminConsole?: boolean;
        };
        if (cancelled) return;
        setCanAccessAdmin(Boolean(payload.canAccessAdminConsole));
      })
      .catch(() => {
        if (cancelled) return;
        setCanAccessAdmin(masterFallback);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.email]);

  async function handleResetConfirm() {
    if (resetBusy) return;

    try {
      setResetBusy(true);
      const result = await safeAction(async () => {
        const response = await fetch("/api/me/reset", { method: "POST" });
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Reset failed.");
        }
      }, {
        context: "shell.resetAccount",
      });

      if (!result.ok) {
        notifyError(result.error, setToast);
        return;
      }

      setResetOpen(false);
      setOpen(false);
      setAvatarRefreshKey((value) => value + 1);
      notifySuccess("Account reset successfully", setToast);
      router.replace(dashboard());
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#FAFBFC] text-slate-900">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm transition hover:bg-slate-50"
              aria-label="Open menu"
            >
              ☰
            </button>

            <Link href={dashboard()} className="truncate text-base font-semibold tracking-tight">
              {title}
            </Link>

            <Button variant="ghost" size="sm" asChild>
              <Link href={dataEntryHome()}>
                <ClipboardList />
                <span className="hidden sm:inline">Data Entry</span>
              </Link>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <AvatarMenu refreshKey={avatarRefreshKey} />
          </div>
        </div>
      </header>

      <Toast toast={toast} position="fixed" />

      {/* Drawer overlay */}
      {open ? (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-80 max-w-[85vw] flex-col border-r border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Menu</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <nav className="mt-4 flex-1 space-y-1">
              {drawerNav.map((n) => {
                const active = pathname === n.href || pathname?.startsWith(n.href + "/");
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className={[
                      "block rounded-lg border px-3 py-2 text-sm transition",
                      active ? "border-[#1E3A5F] bg-[#1E3A5F] text-white" : "border-slate-200 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </nav>

            {/* Bottom actions */}
            <div className="space-y-2 border-t border-slate-200 pt-3">
              {ENABLE_RESET ? (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setResetOpen(true);
                  }}
                  disabled={resetBusy}
                  className="w-full rounded-lg border border-red-300 px-3 py-2 text-left text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Reset Account
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: signin() })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm transition hover:bg-slate-50"
              >
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {ENABLE_RESET && resetOpen ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (!resetBusy) setResetOpen(false);
            }}
          />
          <div className="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
              <h2 className="text-base font-semibold">Reset Account</h2>
              <p className="mt-2 text-sm text-slate-500">
                This will permanently delete all your entries and uploads. This
                cannot be undone.
              </p>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetOpen(false)}
                  disabled={resetBusy}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm transition hover:bg-slate-50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleResetConfirm();
                  }}
                  disabled={resetBusy}
                  className="rounded-lg border border-red-600 bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resetBusy ? "Resetting..." : "Confirm Reset"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Page content */}
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
