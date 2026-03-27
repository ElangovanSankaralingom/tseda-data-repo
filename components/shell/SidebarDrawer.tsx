"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Palette,
  Search,
  Shield,
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
  settingsAppearance,
} from "@/lib/entryNavigation";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";

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
  badgeColor = "bg-amber-500/15",
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
          ? "bg-[var(--color-button-primary-bg)] text-white shadow-sm"
          : "text-[var(--color-sidebar-text)] hover:bg-[var(--color-sidebar-hover-bg)] hover:text-[var(--color-text-primary)]",
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
  const { t } = useTranslation();

  function isActive(href: string) {
    return pathname === href || pathname?.startsWith(href + "/");
  }

  let navIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-[var(--color-modal-overlay)] backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full w-full flex-col bg-[var(--color-sidebar-bg)] shadow-2xl transition-transform duration-300 ease-out sm:w-80",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        role="dialog"
        aria-label="Navigation menu"
      >
        {/* 1. User profile section */}
        <div className="border-b border-[var(--color-card-border)] p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-[var(--color-card-border)]">
              {profilePhoto ? (
                <span
                  className="h-full w-full bg-cover bg-center bg-no-repeat"
                  style={{ backgroundImage: `url("${profilePhoto}")` }}
                />
              ) : (
                <span className="flex size-full items-center justify-center bg-[var(--color-dropdown-hover)] text-sm font-semibold text-[var(--color-sidebar-text)]">
                  {profileInitials}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-[var(--color-text-primary)]">{profileName}</div>
              <div className="truncate text-xs text-[var(--color-text-secondary)]">{profileEmail}</div>
              {profileDesignation ? (
                <span className="mt-1 inline-block rounded-full bg-[var(--color-dropdown-hover)] px-2 py-0.5 text-xs text-[var(--color-sidebar-text)]">
                  {profileDesignation}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* 2. Navigation section */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="px-3 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Navigation</span>
          </div>
          <nav aria-label="Sidebar navigation" className="space-y-0.5">
            <NavItem
              href={dashboard()}
              icon={LayoutDashboard}
              label={t('nav.dashboard')}
              active={isActive(dashboard())}
              onClick={onClose}
              delay={30 * navIndex++}
              visible={open}
            />
            <NavItem
              href={dataEntryHome()}
              icon={ClipboardList}
              label={t('nav.dataEntry')}
              active={isActive(dataEntryHome()) && !isActive(dataEntrySearch())}
              onClick={onClose}
              delay={30 * navIndex++}
              visible={open}
            />
            <NavItem
              href={dataEntrySearch()}
              icon={Search}
              label={t('nav.search')}
              active={isActive(dataEntrySearch())}
              onClick={onClose}
              delay={30 * navIndex++}
              visible={open}
            />
            <NavItem
              href={profile()}
              icon={User}
              label={t('nav.account')}
              active={isActive(profile())}
              onClick={onClose}
              delay={30 * navIndex++}
              visible={open}
            />
          </nav>

          {/* Admin section */}
          {canAccessAdmin ? (
            <>
              <div className="my-2 h-px bg-[var(--color-card-border)]" />
              <div className="px-3 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Admin</span>
              </div>
              <nav aria-label="Admin navigation" className="space-y-0.5">
                <NavItem
                  href={adminHome()}
                  icon={Shield}
                  label={t('nav.admin')}
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
        <div className="border-t border-[var(--color-card-border)] p-4 space-y-1">
          <NavItem
            href={settingsAppearance()}
            icon={Palette}
            label={t('nav.appearance')}
            active={isActive(settingsAppearance())}
            onClick={onClose}
            delay={0}
            visible={open}
          />

          {canAccessAdmin ? (
            <Link
              href="/reset"
              onClick={onClose}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10 hover:text-red-600"
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
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 hover:text-red-700"
          >
            <LogOut className="size-5" />
            <span className="flex-1 text-left">{t('nav.signOut')}</span>
          </button>
        </div>
      </div>
    </>
  );
}
