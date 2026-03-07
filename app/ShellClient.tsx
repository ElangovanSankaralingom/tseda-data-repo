"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ClipboardList,
  FileEdit,
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
import AvatarMenu from "@/components/AvatarMenu";
import { Button } from "@/components/ui/button";
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
  const base = "block h-0.5 w-5 rounded-full bg-slate-700 transition-all duration-300 ease-in-out";
  return (
    <div className="flex flex-col items-center justify-center gap-[5px]">
      <span
        className={cn(base, isOpen && "translate-y-[7px] rotate-45")}
      />
      <span
        className={cn(base, isOpen && "opacity-0")}
      />
      <span
        className={cn(base, isOpen && "-translate-y-[7px] -rotate-45")}
      />
    </div>
  );
}

// --- Nav Item ---

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

// --- Main Component ---

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
  const [menuProfile, setMenuProfile] = useState<ProfileSummary | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

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

      setResetOpen(false);
      setOpen(false);
      setAvatarRefreshKey((value) => value + 1);
      notifySuccess("Account reset successfully", setToast);
      router.replace(dashboard());
    } finally {
      setResetBusy(false);
    }
  }

  // Stagger animation delay base
  let navIndex = 0;

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#FAFBFC] text-slate-900">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-gradient-to-b from-white to-slate-50/50 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className={cn(
                "flex size-10 items-center justify-center rounded-xl transition-colors",
                open ? "bg-slate-100" : "hover:bg-slate-100"
              )}
              aria-label={open ? "Close menu" : "Open menu"}
            >
              <HamburgerIcon isOpen={open} />
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
            {canAccessAdmin ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href={adminHome()}>
                  <Shield />
                  <span className="hidden sm:inline">Admin Console</span>
                </Link>
              </Button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <AvatarMenu refreshKey={avatarRefreshKey} showName />
          </div>
        </div>
      </header>

      <Toast toast={toast} position="fixed" />

      {/* Sidebar drawer */}
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
                setResetOpen(true);
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
            onClick={() => signOut({ callbackUrl: signin() })}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="size-5" />
            <span className="flex-1 text-left">Sign out</span>
          </button>
        </div>
      </aside>

      {/* Reset confirmation dialog */}
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
