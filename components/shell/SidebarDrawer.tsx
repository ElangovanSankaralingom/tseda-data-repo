"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Search,
  Shield,
  Sun,
  Trash2,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  adminHome,
  dashboard,
  dataEntryHome,
  dataEntrySearch,
  profile,
} from "@/lib/entryNavigation";
import { cn } from "@/lib/utils";

type NavItemProps = {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  badge?: number;
  badgeColor?: string;
  onClick: () => void;
  delay?: number;
  visible?: boolean;
};

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  badge,
  badgeColor = "bg-amber-500",
  onClick,
  delay = 0,
  visible = true,
}: NavItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
      )}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-white" />
      )}
      <Icon className="size-5 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge && badge > 0 ? (
        <span className={cn(
          "flex size-5 items-center justify-center rounded-full text-xs font-bold text-white",
          badgeColor
        )}>
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export default function SidebarDrawer({
  open,
  onClose,
  canAccessAdmin,
  profileName,
  profileEmail,
  profilePhoto,
  profileInitials,
  profileDesignation,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  canAccessAdmin: boolean;
  profileName: string;
  profileEmail: string;
  profilePhoto: string;
  profileInitials: string;
  profileDesignation: string | null;
  onSignOut: () => void;
}) {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname?.startsWith(href + "/");
  }

  let navIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-out sm:w-80",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        role="dialog"
        aria-label="Navigation menu"
      >
        {/* 1. User profile section */}
        <div className="border-b border-slate-100 p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-slate-100">
              {profilePhoto ? (
                <span
                  className="h-full w-full bg-cover bg-center bg-no-repeat"
                  style={{ backgroundImage: `url("${profilePhoto}")` }}
                />
              ) : (
                <span className="flex size-full items-center justify-center bg-slate-100 text-sm font-semibold text-slate-600">
                  {profileInitials}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-slate-900">{profileName}</div>
              <div className="truncate text-xs text-slate-500">{profileEmail}</div>
              {profileDesignation ? (
                <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {profileDesignation}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* 2. Navigation section */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="px-3 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Navigation</span>
          </div>
          <nav aria-label="Sidebar navigation" className="space-y-0.5">
            <NavItem
              href={dashboard()}
              icon={LayoutDashboard}
              label="Dashboard"
              active={isActive(dashboard())}
              onClick={onClose}
              delay={30 * navIndex++}
              visible={open}
            />
            <NavItem
              href={dataEntryHome()}
              icon={ClipboardList}
              label="Data Entry"
              active={isActive(dataEntryHome()) && !isActive(dataEntrySearch())}
              onClick={onClose}
              delay={30 * navIndex++}
              visible={open}
            />
            <NavItem
              href={dataEntrySearch()}
              icon={Search}
              label="Search"
              active={isActive(dataEntrySearch())}
              onClick={onClose}
              delay={30 * navIndex++}
              visible={open}
            />
            <NavItem
              href={profile()}
              icon={User}
              label="My Account"
              active={isActive(profile())}
              onClick={onClose}
              delay={30 * navIndex++}
              visible={open}
            />
          </nav>

          {/* Admin section */}
          {canAccessAdmin ? (
            <>
              <div className="my-2 h-px bg-slate-100" />
              <div className="px-3 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Admin</span>
              </div>
              <nav aria-label="Admin navigation" className="space-y-0.5">
                <NavItem
                  href={adminHome()}
                  icon={Shield}
                  label="Admin Console"
                  active={isActive(adminHome())}
                  onClick={onClose}
                  delay={30 * navIndex++}
                  visible={open}
                />
              </nav>
            </>
          ) : null}
        </div>

        {/* 3. Bottom section */}
        <div className="border-t border-slate-100 p-4 space-y-1">
          <div className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 cursor-not-allowed" title="Coming soon">
            <Sun className="size-5" />
            <span className="flex-1">Appearance</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Soon</span>
          </div>

          {canAccessAdmin ? (
            <Link
              href="/reset"
              onClick={onClose}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="size-5" />
              <span className="flex-1 text-left">Reset Test Data</span>
            </Link>
          ) : null}

          <button
            type="button"
            onClick={() => {
              onClose();
              onSignOut();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="size-5" />
            <span className="flex-1 text-left">Sign out</span>
          </button>
        </div>
      </div>
    </>
  );
}
