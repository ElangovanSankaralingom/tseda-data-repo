"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutDashboard, Shield } from "lucide-react";
import AdminNotificationBell from "@/components/confirmations/AdminNotificationBell";
import NotificationBell from "@/components/confirmations/NotificationBell";
import SearchTrigger from "@/components/shell/SearchTrigger";
import HeaderNavPill from "@/components/shell/HeaderNavPill";
import ProfileDropdown from "@/components/shell/ProfileDropdown";
import SidebarDrawer from "@/components/shell/SidebarDrawer";
import { getInitials, type ProfileSummary } from "@/components/shell/shellTypes";
import { useConfirmation } from "@/components/confirmations/ConfirmationProvider";
import Toast from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { isMasterAdmin } from "@/lib/admin";
import { useTranslation } from "@/lib/i18n/useTranslation";
import {
  adminHome,
  dashboard,
  signin,
} from "@/lib/entryNavigation";

// --- Animated Hamburger Icon ---

/*
  ── Command Grid Icon ──
  Cross-fade between 2x2 dot grid (closed) and X (open).
  No conflicting CSS — each layer only toggles opacity + rotation.
*/
function CommandGridIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <div className="relative size-[18px]">
      {/* Layer 1: 2x2 dot grid — visible when closed */}
      <div
        className="absolute inset-0 grid grid-cols-2 place-items-center transition-all duration-300"
        style={{
          opacity: isOpen ? 0 : 1,
          transform: isOpen ? "scale(0.6) rotate(45deg)" : "none",
          gap: 4,
          padding: 2,
        }}
      >
        <span className="block size-[4px] rounded-full bg-[var(--color-text-secondary)]" />
        <span className="block size-[4px] rounded-full bg-[var(--color-text-secondary)]" />
        <span className="block size-[4px] rounded-full bg-[var(--color-text-secondary)]" />
        <span className="block size-[4px] rounded-full bg-[var(--color-text-secondary)]" />
      </div>

      {/* Layer 2: X lines — visible when open */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-all duration-300"
        style={{
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? "none" : "scale(0.6) rotate(-45deg)",
        }}
      >
        <span
          className="absolute h-[2px] w-[16px] rounded-full bg-[var(--color-text-secondary)]"
          style={{ transform: "rotate(45deg)" }}
        />
        <span
          className="absolute h-[2px] w-[16px] rounded-full bg-[var(--color-text-secondary)]"
          style={{ transform: "rotate(-45deg)" }}
        />
      </div>
    </div>
  );
}

// --- Scroll state hook ---

function useScrolled(threshold = 0) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > threshold);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return scrolled;
}

// --- Main Component ---

export default function ShellClient({
  children,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { confirm: confirmAction } = useConfirmation();

  const [canAccessAdmin, setCanAccessAdmin] = useState(() =>
    isMasterAdmin(session?.user?.email)
  );
  const [open, setOpen] = useState(false);
  const [toast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [menuProfile, setMenuProfile] = useState<ProfileSummary | null>(null);
  const scrolled = useScrolled(0);
  const { t } = useTranslation();

  const [adminBellOpen, setAdminBellOpen] = useState(false);
  const [userBellOpen, setUserBellOpen] = useState(false);

  // Fetch profile for menu
  useEffect(() => {
    let ignore = false;
    void fetch("/api/me", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok || ignore) return;
        const data = (await r.json()) as ProfileSummary;
        if (!ignore) setMenuProfile(data);
      })
      .catch(() => {});
    return () => { ignore = true; };
  }, []);

  // Admin capabilities
  useEffect(() => {
    const email = session?.user?.email ?? "";
    const masterFallback = isMasterAdmin(email);
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

    return () => { cancelled = true; };
  }, [session?.user?.email]);

  // Escape key + body scroll lock
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  const closeMenu = useCallback(() => setOpen(false), []);

  function isActive(href: string) {
    return pathname === href || pathname?.startsWith(href + "/");
  }

  // Profile data
  const profileName = useMemo(() => {
    return String(
      menuProfile?.officialName ??
      menuProfile?.userPreferredName ??
      menuProfile?.googleName ??
      menuProfile?.email?.split("@")[0] ??
      "User"
    ).trim();
  }, [menuProfile]);
  const profileEmail = String(menuProfile?.email ?? "").trim();
  const profilePhoto = String(menuProfile?.googlePhotoURL ?? "").trim();
  const profileInitials = getInitials(profileName, profileEmail);
  const profileDesignation = menuProfile?.designation ?? null;

  function handleSignOut() {
    void confirmAction({
      type: "info",
      title: "Sign out?",
      message: "You'll need to sign in again with your Google account.",
      confirmLabel: "Sign out",
      confirmStyle: "primary",
    }).then((confirmed) => {
      if (confirmed) signOut({ callbackUrl: signin() });
    });
  }

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[var(--color-body-bg)] text-[var(--color-text-primary)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-[var(--color-button-primary-bg)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>
      {/* ─── Fixed Header ─── */}
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 h-14 border-b transition-all duration-300",
          scrolled
            ? "bg-[var(--color-header-bg)] backdrop-blur-2xl border-[var(--color-glass-border)] shadow-lg shadow-black/20"
            : "bg-[var(--color-header-bg)] backdrop-blur-xl border-transparent"
        )}
      >
        <div className="mx-auto flex h-full max-w-screen-2xl items-center justify-between px-4 sm:px-6">
          {/* Left: Hamburger + Brand */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className={cn(
                "flex size-9 items-center justify-center rounded-xl transition-colors duration-150",
                open ? "bg-[var(--color-dropdown-hover)]" : "hover:bg-[var(--color-dropdown-hover)]"
              )}
              aria-label={open ? "Close menu" : "Open menu"}
            >
              <CommandGridIcon isOpen={open} />
            </button>

            <Link href={dashboard()} className="flex items-center gap-2 group">
              <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--color-button-primary-bg)] text-sm font-bold text-[var(--color-button-primary-text)] shadow-[0_0_16px_var(--color-glow-primary)] transition-all duration-300 group-hover:rotate-3 group-hover:scale-105 group-hover:shadow-[0_0_24px_var(--color-glow-primary)]">
                T
              </span>
              <span className="hidden text-base font-bold tracking-tight text-[var(--color-text-primary)] sm:block">
                T&apos;SEDA
              </span>
            </Link>
          </div>

          {/* Center: Navigation Pills */}
          <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
            <HeaderNavPill href={dashboard()} icon={LayoutDashboard} label={t('nav.dashboard')} active={isActive(dashboard())} />
            {canAccessAdmin && (
              <HeaderNavPill href={adminHome()} icon={Shield} label={t('nav.admin')} active={isActive(adminHome())} />
            )}
          </nav>

          {/* Right: Utilities */}
          <div className="flex items-center gap-1">
            <SearchTrigger />
            {canAccessAdmin && (
              <AdminNotificationBell onPanelToggle={setAdminBellOpen} forceClose={userBellOpen} />
            )}
            <NotificationBell onPanelToggle={setUserBellOpen} forceClose={adminBellOpen} />
            <ProfileDropdown
              name={profileName}
              email={profileEmail}
              photoUrl={profilePhoto}
              initials={profileInitials}
              isAdmin={canAccessAdmin}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      </header>

      <Toast toast={toast} position="fixed" />

      {/* ─── Sidebar Drawer ─── */}
      <SidebarDrawer
        open={open}
        onClose={closeMenu}
        canAccessAdmin={canAccessAdmin}
        profileName={profileName}
        profileEmail={profileEmail}
        profilePhoto={profilePhoto}
        profileInitials={profileInitials}
        profileDesignation={profileDesignation}
        onSignOut={handleSignOut}
      />

      {/* ─── Page Content ─── */}
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-6 pt-20 outline-none">{children}</main>
    </div>
  );
}
