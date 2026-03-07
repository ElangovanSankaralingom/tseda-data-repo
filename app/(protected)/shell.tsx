"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { dashboard, profile, signin } from "@/lib/entryNavigation";

const nav = [
  { href: dashboard(), label: "Dashboard" },
  { href: profile(), label: "My Account" },
  { href: `${profile()}/print`, label: "Print Profile" },
];

export default function AppShell({
  children,
  email,
}: {
  children: React.ReactNode;
  email: string;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background relative">
      {/* Header */}
      <header className="h-14 border-b border-slate-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="text-xl font-semibold"
          >
            ☰
          </button>

          <span className="font-semibold tracking-tight">
            T&apos;SEDA Data Repository
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={profile()}
            className="text-sm px-3 py-1 border rounded"
          >
            My Account
          </Link>
        </div>
      </header>

      {/* Drawer Overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-white shadow-lg z-50 transform transition-transform duration-300 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b border-slate-200">
          <div className="font-semibold">T&apos;SEDA Data Repository</div>
          <div className="text-xs text-slate-500 mt-1">{email}</div>
        </div>

        <div className="flex flex-col h-full justify-between">
          {/* Main Nav */}
          <div className="p-3 space-y-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setDrawerOpen(false)}
                className={`block px-3 py-2 rounded text-sm ${
                  pathname === item.href
                    ? "bg-slate-200"
                    : "hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Bottom Section */}
          <div className="p-3 border-t border-slate-200 space-y-1">
            <Link
              href={profile()}
              onClick={() => setDrawerOpen(false)}
              className="block px-3 py-2 rounded text-sm hover:bg-slate-100"
            >
              My Account
            </Link>

            <button
              onClick={() => signOut({ callbackUrl: signin() })}
              className="w-full text-left px-3 py-2 rounded text-sm text-red-600 hover:bg-red-50"
            >
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Page Content */}
      <main className="p-6">{children}</main>
    </div>
  );
}
