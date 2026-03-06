"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import AvatarMenu from "@/components/AvatarMenu";
import { isMasterAdmin } from "@/lib/admin";
import {
  adminHome,
  dashboard,
  dataEntryHome,
  profile,
  signin,
} from "@/lib/navigation";
import { safeAction } from "@/lib/safeAction";
import { notifyError, notifySuccess } from "@/lib/ui/notify";

const ENABLE_RESET = true;

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

  const nav = [
    { href: dashboard(), label: "Dashboard" },
    { href: dataEntryHome(), label: "Data Entry" },
    { href: profile(), label: "My Account" },
  ];
  const drawerNav = canAccessAdmin
    ? [...nav, { href: adminHome(), label: "⚙️ Admin Console" }]
    : nav;

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
    <div className="min-h-dvh bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted transition"
              aria-label="Open menu"
            >
              ☰
            </button>
            <Link href={dashboard()} className="font-semibold">
              {title}
            </Link>
            <Link
              href={dataEntryHome()}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-foreground bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-colors duration-150 hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
            >
              Data Entry
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {ENABLE_RESET ? (
              <button
                type="button"
                onClick={() => setResetOpen(true)}
                disabled={resetBusy}
                className="rounded-full border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground disabled:opacity-60"
              >
                Reset Account
              </button>
            ) : null}
            {canAccessAdmin ? (
              <Link
                href={adminHome()}
                className="inline-flex items-center gap-2 rounded-full border border-black bg-black px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
              >
                <span aria-hidden="true">⚙️</span>
                <span>Admin Console</span>
              </Link>
            ) : null}
            <AvatarMenu refreshKey={avatarRefreshKey} />
          </div>
        </div>
      </header>

      {toast ? (
        <div className="fixed right-4 top-20 z-50">
          <div
            className={[
              "rounded-xl border px-3 py-2 text-sm shadow-sm",
              toast.type === "ok"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800",
            ].join(" ")}
          >
            {toast.msg}
          </div>
        </div>
      ) : null}

      {/* Drawer overlay */}
      {open ? (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-80 max-w-[85vw] bg-background border-r border-border p-4 flex flex-col">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Menu</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted transition"
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
                      "block rounded-lg px-3 py-2 text-sm border transition",
                      active ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted",
                    ].join(" ")}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </nav>

            {/* Bottom actions */}
            <div className="pt-3 border-t border-border space-y-2">
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: signin() })}
                className="w-full rounded-lg px-3 py-2 text-sm border border-border hover:bg-muted transition text-left"
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
            <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
              <h2 className="text-base font-semibold">Reset Account</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This will permanently delete all your entries and uploads. This
                cannot be undone.
              </p>
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetOpen(false)}
                  disabled={resetBusy}
                  className="rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-muted disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleResetConfirm();
                  }}
                  disabled={resetBusy}
                  className="rounded-lg border border-red-600 bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-60"
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
