"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import AvatarMenu from "@/components/AvatarMenu";

export default function ShellClient({
  children,
  title = "T'SEDA Data Repository",
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/data-entry", label: "Data Entry" },
    { href: "/account", label: "My Account" },
  ];

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
            <Link href="/dashboard" className="font-semibold">
              {title}
            </Link>
            <Link
              href="/data-entry"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-foreground bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-colors duration-150 hover:opacity-90 active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
            >
              Data Entry
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <AvatarMenu />
          </div>
        </div>
      </header>

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
              {nav.map((n) => {
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
                onClick={() => signOut({ callbackUrl: "/signin" })}
                className="w-full rounded-lg px-3 py-2 text-sm border border-border hover:bg-muted transition text-left"
              >
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {/* Page content */}
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
