"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import {
  BookOpen,
  ChevronDown,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Mic,
  Presentation,
  Search,
  Shield,
  Sun,
  User,
  Wrench,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import NotificationBell from "@/components/confirmations/NotificationBell";
import { useSearch } from "@/components/search/SearchProvider";
import { CATEGORY_LIST, getCategoryConfig, type CategorySlug } from "@/data/categoryRegistry";
import { isMasterAdmin } from "@/lib/admin";
import {
  adminHome,
  dashboard,
  dataEntryHome,
  dataEntrySearch,
  entryList,
  profile,
  signin,
} from "@/lib/entryNavigation";
import { useConfirmation } from "@/components/confirmations/ConfirmationProvider";
import Toast from "@/components/ui/Toast";
import { safeAction } from "@/lib/safeAction";
import { notifyError, notifySuccess } from "@/lib/ui/notify";
import { cn } from "@/lib/utils";

const ENABLE_RESET = true;

// Category icons & accent colors for the sidebar
const CATEGORY_ICONS: Record<CategorySlug, LucideIcon> = {
  "fdp-attended": BookOpen,
  "fdp-conducted": Presentation,
  "case-studies": FileText,
  "guest-lectures": Mic,
  workshops: Wrench,
};

const CATEGORY_ACCENT_BG: Record<CategorySlug, string> = {
  "fdp-attended": "bg-blue-100",
  "fdp-conducted": "bg-emerald-100",
  "case-studies": "bg-purple-100",
  "guest-lectures": "bg-amber-100",
  workshops: "bg-rose-100",
};

const CATEGORY_ACCENT_ICON: Record<CategorySlug, string> = {
  "fdp-attended": "text-blue-600",
  "fdp-conducted": "text-emerald-600",
  "case-studies": "text-purple-600",
  "guest-lectures": "text-amber-600",
  workshops: "text-rose-600",
};

// --- Animated Hamburger Icon ---

function HamburgerIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <div className="group flex flex-col items-center justify-center gap-[5px]">
      <span
        className={cn(
          "block h-[2px] w-[18px] rounded-full bg-slate-700 transition-all duration-300 ease-in-out",
          isOpen
            ? "translate-y-[7px] rotate-45"
            : "group-hover:translate-x-[1px]"
        )}
      />
      <span
        className={cn(
          "block h-[2px] w-[18px] rounded-full bg-slate-700 transition-all duration-300 ease-in-out",
          isOpen && "opacity-0"
        )}
      />
      <span
        className={cn(
          "block h-[2px] w-[18px] rounded-full bg-slate-700 transition-all duration-300 ease-in-out",
          isOpen
            ? "-translate-y-[7px] -rotate-45"
            : "group-hover:-translate-x-[1px]"
        )}
      />
    </div>
  );
}

// --- Sidebar Nav Item ---

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

// --- Profile Summary type ---

type ProfileSummary = {
  email?: string;
  officialName?: string;
  userPreferredName?: string;
  googleName?: string;
  googlePhotoURL?: string;
  designation?: string;
};

function getInitials(name: string, email: string) {
  const source = name.trim() || email.split("@")[0] || "U";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

// --- Search Trigger ---

function SearchTrigger() {
  const { open } = useSearch();
  return (
    <>
      {/* Desktop: search bar */}
      <button
        type="button"
        onClick={open}
        className="hidden items-center gap-2 rounded-xl bg-slate-100 px-3 h-9 w-48 cursor-pointer transition-colors hover:bg-slate-200 lg:flex"
      >
        <Search className="size-4 text-slate-400" />
        <span className="flex-1 text-left text-sm text-slate-400">Search...</span>
        <kbd className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-500 shadow-sm">⌘K</kbd>
      </button>
      {/* Mobile/tablet: icon only */}
      <button
        type="button"
        onClick={open}
        className="flex size-9 items-center justify-center rounded-xl transition-colors hover:bg-slate-100 lg:hidden"
        aria-label="Search (⌘K)"
        title="Search (⌘K)"
      >
        <Search className="size-[18px] text-slate-500 hover:text-slate-900 transition-colors" />
      </button>
    </>
  );
}

// --- Header Nav Pill ---

function HeaderNavPill({
  href,
  icon: Icon,
  label,
  active,
  hasDot,
  dotColor = "bg-amber-500",
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  hasDot?: boolean;
  dotColor?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-all duration-200",
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
      )}
    >
      <Icon className="size-4" />
      <span>{label}</span>
      {hasDot && (
        <span className={cn("size-1.5 rounded-full animate-subtle-pulse", dotColor)} />
      )}
      {/* Active indicator bar */}
      {active && (
        <span className="absolute -bottom-2.5 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-slate-900" />
      )}
    </Link>
  );
}

// --- Profile Dropdown ---

function ProfileDropdown({
  name,
  email,
  photoUrl,
  initials,
  isAdmin,
  onSignOut,
}: {
  name: string;
  email: string;
  photoUrl: string;
  initials: string;
  isAdmin: boolean;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl px-2 py-1 transition-colors hover:bg-slate-100 cursor-pointer"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {/* Avatar */}
        <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-slate-100">
          {photoUrl ? (
            <span
              className="h-full w-full bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url("${photoUrl}")` }}
            />
          ) : (
            <span className="flex size-full items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900 text-xs font-bold text-white">
              {initials}
            </span>
          )}
        </span>
        {/* Name + chevron (hidden on mobile) */}
        <span className="hidden items-center gap-1 sm:flex">
          <span className="max-w-[120px] truncate text-sm font-medium text-slate-700">{name}</span>
          <ChevronDown className={cn(
            "size-3 text-slate-400 transition-transform duration-200",
            open && "rotate-180"
          )} />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 origin-top-right rounded-xl border border-slate-200 bg-white py-2 shadow-2xl animate-scale-in"
        >
          {/* User info */}
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">{name}</div>
            <div className="truncate font-mono text-xs text-slate-500">{email}</div>
            {isAdmin && (
              <span className="mt-1 inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                Admin
              </span>
            )}
          </div>

          {/* Navigation items */}
          <Link
            href={profile()}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mx-1 flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
          >
            <User className="size-4" />
            My Account
          </Link>

          <div className="my-1 h-px bg-slate-100" />

          {/* Sign out */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="mx-1 flex w-[calc(100%-0.5rem)] items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50 cursor-pointer"
          >
            <LogOut className="size-4" />
            Sign Out
          </button>
        </div>
      )}
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
    onScroll(); // check initial state
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
  const router = useRouter();
  const { data: session } = useSession();
  const { confirm: confirmAction } = useConfirmation();

  // Refresh server components when user returns to the tab after 1+ minute away
  useRefreshOnFocus({ minInterval: 60000 });

  const [canAccessAdmin, setCanAccessAdmin] = useState(() =>
    isMasterAdmin(session?.user?.email)
  );
  const [open, setOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(0);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [menuProfile, setMenuProfile] = useState<ProfileSummary | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const scrolled = useScrolled(0);

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
  }, [avatarRefreshKey]);

  // Admin capabilities
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

    return () => { cancelled = true; };
  }, [session?.user?.email]);

  // Escape key to close menu
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
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

  // Category items
  const categoryItems = useMemo(() => {
    return CATEGORY_LIST.map((slug) => {
      const config = getCategoryConfig(slug);
      return {
        slug,
        label: config.label,
        href: entryList(slug),
        Icon: CATEGORY_ICONS[slug],
        accentBg: CATEGORY_ACCENT_BG[slug],
        accentIcon: CATEGORY_ACCENT_ICON[slug],
      };
    });
  }, []);

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

      setOpen(false);
      setAvatarRefreshKey((value) => value + 1);
      notifySuccess("Account reset successfully", setToast);
      router.replace(dashboard());
    } finally {
      setResetBusy(false);
    }
  }

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

  // Stagger animation delay base
  let navIndex = 0;

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#FAFBFC] text-slate-900">
      {/* ─── Fixed Header ─── */}
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 h-14 border-b backdrop-blur-xl transition-shadow duration-200",
          scrolled
            ? "bg-white/90 border-slate-200/80 shadow-sm"
            : "bg-white/70 border-slate-200/50"
        )}
      >
        <div className="mx-auto flex h-full max-w-screen-2xl items-center justify-between px-4 sm:px-6">
          {/* ── Left: Hamburger + Brand ── */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className={cn(
                "flex size-9 items-center justify-center rounded-xl transition-colors duration-150",
                open ? "bg-slate-100" : "hover:bg-slate-100"
              )}
              aria-label={open ? "Close menu" : "Open menu"}
            >
              <HamburgerIcon isOpen={open} />
            </button>

            {/* Brand */}
            <Link href={dashboard()} className="flex items-center gap-2 group">
              <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 text-sm font-bold text-white transition-transform duration-300 group-hover:rotate-3 group-hover:scale-105">
                T
              </span>
              <span className="hidden text-base font-bold tracking-tight text-slate-900 sm:block">
                T&apos;SEDA
              </span>
            </Link>
          </div>

          {/* ── Center: Navigation Pills ── */}
          <nav className="hidden items-center gap-1 md:flex">
            <HeaderNavPill
              href={dashboard()}
              icon={LayoutDashboard}
              label="Dashboard"
              active={isActive(dashboard())}
            />
            <HeaderNavPill
              href={dataEntryHome()}
              icon={ClipboardList}
              label="Data Entry"
              active={isActive(dataEntryHome())}
            />
            {canAccessAdmin && (
              <HeaderNavPill
                href={adminHome()}
                icon={Shield}
                label="Admin"
                active={isActive(adminHome())}
              />
            )}
          </nav>

          {/* ── Right: Utilities ── */}
          <div className="flex items-center gap-1">
            <SearchTrigger />
            <NotificationBell />
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
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={closeMenu}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        ref={panelRef}
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
                <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                  {profileDesignation}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* 2. Navigation section */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="px-3 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Navigation</span>
          </div>
          <nav className="space-y-0.5">
            <NavItem
              href={dashboard()}
              icon={LayoutDashboard}
              label="Dashboard"
              active={isActive(dashboard())}
              onClick={closeMenu}
              delay={30 * navIndex++}
              visible={open}
            />
            <NavItem
              href={dataEntryHome()}
              icon={ClipboardList}
              label="Data Entry"
              active={isActive(dataEntryHome()) && !isActive(dataEntrySearch())}
              onClick={closeMenu}
              delay={30 * navIndex++}
              visible={open}
            />
            <NavItem
              href={dataEntrySearch()}
              icon={Search}
              label="Search"
              active={isActive(dataEntrySearch())}
              onClick={closeMenu}
              delay={30 * navIndex++}
              visible={open}
            />
            <NavItem
              href={profile()}
              icon={User}
              label="My Account"
              active={isActive(profile())}
              onClick={closeMenu}
              delay={30 * navIndex++}
              visible={open}
            />
          </nav>

          {/* Admin section */}
          {canAccessAdmin ? (
            <>
              <div className="my-2 h-px bg-slate-100" />
              <div className="px-3 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Admin</span>
              </div>
              <nav className="space-y-0.5">
                <NavItem
                  href={adminHome()}
                  icon={Shield}
                  label="Admin Console"
                  active={isActive(adminHome())}
                  onClick={closeMenu}
                  delay={30 * navIndex++}
                  visible={open}
                />
              </nav>
            </>
          ) : null}

          {/* 3. Category quick links */}
          <div className="my-2 h-px bg-slate-100" />
          <div className="px-3 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Categories</span>
          </div>
          <nav className="space-y-0.5 overflow-y-auto sm:max-h-none max-h-[40vh]">
            {categoryItems.map((cat) => (
              <Link
                key={cat.slug}
                href={cat.href}
                onClick={closeMenu}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-150",
                  isActive(cat.href)
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-50",
                  open ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                )}
                style={{ transitionDelay: open ? `${30 * navIndex++}ms` : "0ms" }}
              >
                <span className={cn("flex size-6 items-center justify-center rounded-full", cat.accentBg)}>
                  <cat.Icon className={cn("size-3.5", isActive(cat.href) ? "text-white" : cat.accentIcon)} />
                </span>
                <span className="flex-1 truncate">{cat.label}</span>
              </Link>
            ))}
          </nav>
        </div>

        {/* 4. Bottom section */}
        <div className="border-t border-slate-100 p-4 space-y-1">
          {/* Appearance (future-ready) */}
          <div className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 cursor-not-allowed" title="Coming soon">
            <Sun className="size-5" />
            <span className="flex-1">Appearance</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">Soon</span>
          </div>

          {/* Reset Account */}
          {ENABLE_RESET ? (
            <button
              type="button"
              onClick={() => {
                closeMenu();
                void confirmAction({
                  type: "danger",
                  title: "Reset Account",
                  message: "This will permanently delete all your entries and uploads. This cannot be undone.",
                  confirmLabel: "Confirm Reset",
                  confirmStyle: "danger",
                  requireTypedConfirmation: "RESET",
                  countdown: 3,
                }).then((confirmed) => {
                  if (confirmed) void handleResetConfirm();
                });
              }}
              disabled={resetBusy}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-amber-600 transition-colors hover:bg-amber-50 hover:text-amber-700 disabled:pointer-events-none disabled:opacity-60"
            >
              <X className="size-5" />
              <span className="flex-1 text-left">Reset Account</span>
            </button>
          ) : null}

          {/* Sign Out */}
          <button
            type="button"
            onClick={() => {
              closeMenu();
              handleSignOut();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="size-5" />
            <span className="flex-1 text-left">Sign out</span>
          </button>
        </div>
      </aside>

      {/* ─── Page Content ─── */}
      <main className="mx-auto max-w-6xl px-4 pb-6 pt-20">{children}</main>
    </div>
  );
}
