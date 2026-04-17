"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutDashboard, Shield, Zap, Database, Clock, FileText, Info, X } from "lucide-react";
import CursorGlow from "@/components/dashboard/CursorGlow";
import AdminNotificationBell from "@/components/confirmations/AdminNotificationBell";
import NotificationBell from "@/components/confirmations/NotificationBell";
import SearchTrigger from "@/components/shell/SearchTrigger";
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

/*
  ───────────────────────────────────────────────────────
   GLASS DOCK HEADER

   Not a standard full-width bar. A floating glass capsule
   with three distinct zones separated by dividers:

   ┌─────────┬──────────────────────┬─────────────┐
   │ ⠿  T    │  ◉ Dashboard         │  🔍 🔔 👤   │
   └─────────┴──────────────────────┴─────────────┘
   ═══════════════ accent line ═══════════════════

   Zone 1: Brand identity (menu + logo)
   Zone 2: Context strip (current page + indicator)
   Zone 3: Utility cluster (search, bells, avatar)

   The capsule floats with margins, has glass blur,
   inner glow borders, and a bottom accent line.
  ───────────────────────────────────────────────────────
*/

/* ── Command Grid Icon ── */
function CommandGridIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <div className="relative size-[18px]">
      <div
        className="absolute inset-0 grid grid-cols-2 place-items-center transition-all duration-300"
        style={{
          opacity: isOpen ? 0 : 1,
          transform: isOpen ? "scale(0.6) rotate(45deg)" : "none",
          gap: 5,
          padding: 1,
        }}
      >
        <span className="block size-[3.5px] rounded-full bg-white/70" />
        <span className="block size-[3.5px] rounded-full bg-white/70" />
        <span className="block size-[3.5px] rounded-full bg-white/70" />
        <span className="block size-[3.5px] rounded-full bg-white/70" />
      </div>
      <div
        className="absolute inset-0 flex items-center justify-center transition-all duration-300"
        style={{
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? "none" : "scale(0.6) rotate(-45deg)",
        }}
      >
        <span className="absolute h-[1.5px] w-[14px] rounded-full bg-white/70" style={{ transform: "rotate(45deg)" }} />
        <span className="absolute h-[1.5px] w-[14px] rounded-full bg-white/70" style={{ transform: "rotate(-45deg)" }} />
      </div>
    </div>
  );
}

/* ── Context page data — maps pathname to accent + label ── */
const PAGE_CONTEXT: Record<string, { accent: string; icon: typeof LayoutDashboard }> = {
  "/dashboard": { accent: "#3b82f6", icon: LayoutDashboard },
  "/admin": { accent: "#f59e0b", icon: Shield },
};

function usePageContext(pathname: string | null) {
  if (!pathname) return { accent: "var(--color-primary)", icon: LayoutDashboard, label: "" };
  for (const [prefix, ctx] of Object.entries(PAGE_CONTEXT)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return ctx;
  }
  return { accent: "var(--color-primary)", icon: LayoutDashboard };
}

/* ── Scroll hook ── */
function useScrolled(threshold = 0) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > threshold); }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

export default function ShellClient({
  children,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { confirm: confirmAction } = useConfirmation();
  const { t } = useTranslation();
  const pageCtx = usePageContext(pathname);

  const [canAccessAdmin, setCanAccessAdmin] = useState(() =>
    isMasterAdmin(session?.user?.email)
  );
  const [open, setOpen] = useState(false);
  const [toast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [menuProfile, setMenuProfile] = useState<ProfileSummary | null>(null);
  const scrolled = useScrolled(0);

  const [adminBellOpen, setAdminBellOpen] = useState(false);
  const [userBellOpen, setUserBellOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const aboutRef = useRef<HTMLDivElement>(null);

  // Fetch profile
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
        const payload = (await response.json()) as { canAccessAdminConsole?: boolean };
        if (cancelled) return;
        setCanAccessAdmin(Boolean(payload.canAccessAdminConsole));
      })
      .catch(() => { if (cancelled) return; setCanAccessAdmin(masterFallback); });
    return () => { cancelled = true; };
  }, [session?.user?.email]);

  // Escape + body scroll lock
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handleKeyDown); document.body.style.overflow = ""; };
  }, [open]);

  // Close about popover on click outside or Escape
  useEffect(() => {
    if (!aboutOpen) return;
    function handleClick(e: MouseEvent) {
      if (aboutRef.current && !aboutRef.current.contains(e.target as Node)) setAboutOpen(false);
    }
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") setAboutOpen(false); }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("keydown", handleKey); };
  }, [aboutOpen]);

  const closeMenu = useCallback(() => setOpen(false), []);

  function isActive(href: string) {
    return pathname === href || pathname?.startsWith(href + "/");
  }

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
    <div className="min-h-dvh overflow-x-hidden text-[var(--color-text-primary)]">
      {/* Static dot grid — fades out after header+hero zone */}
      <div className="pointer-events-none fixed inset-0 z-0 dot-overlay" />
      <CursorGlow />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-[var(--color-button-primary-bg)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>

      {/* ═══ FLOATING GLASS DOCK ═══ */}
      <header className="fixed top-0 left-0 right-0 z-50 px-3 pt-2 pointer-events-none">
        <div
          className={cn(
            "pointer-events-auto mx-auto max-w-screen-2xl transition-all duration-500",
            scrolled
              ? "rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1.5px_var(--color-border-default)]"
              : "rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.3),0_0_0_1.5px_var(--color-border-default)]"
          )}
          style={{
            background: scrolled
              ? "rgba(8,10,18,0.85)"
              : "rgba(8,10,18,0.70)",
            backdropFilter: "blur(24px) saturate(1.2)",
            WebkitBackdropFilter: "blur(24px) saturate(1.2)",
          }}
        >
          {/* ── Inner layout ── */}
          <div className="flex h-12 items-center">

            {/* ═══ ZONE 1: Brand Identity ═══ */}
            <div className="flex items-center gap-2.5 pl-3 pr-4">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg transition-all duration-200",
                  open
                    ? "bg-white/[0.08]"
                    : "hover:bg-white/[0.06] hover:scale-105 active:scale-95"
                )}
                aria-label={open ? "Close menu" : "Open menu"}
              >
                <CommandGridIcon isOpen={open} />
              </button>

              <Link href={dashboard()} className="flex items-center group">
                <span
                  className="flex size-6 items-center justify-center rounded-md text-[11px] font-black text-white transition-all duration-300 group-hover:scale-110"
                  style={{
                    backgroundColor: "var(--color-primary)",
                    boxShadow: scrolled
                      ? "0 0 12px var(--color-glow-primary)"
                      : "0 0 8px var(--color-glow-primary)",
                  }}
                >
                  T
                </span>
              </Link>
              <div className="relative" ref={aboutRef}>
                <button
                  type="button"
                  onClick={() => setAboutOpen((v) => !v)}
                  className={cn(
                    "hidden sm:flex items-center gap-1.5 rounded-lg px-2 py-1 transition-all duration-200 cursor-pointer",
                    aboutOpen
                      ? "bg-white/[0.08]"
                      : "hover:bg-white/[0.06]"
                  )}
                >
                  <span className="text-[13px] font-bold tracking-tight text-white/80">
                    T&apos;SEDA
                  </span>
                  <Info size={12} style={{ color: "var(--color-icon-muted)" }} />
                </button>

                {/* ── About Popover ── */}
                {aboutOpen && (
                  <div
                    className="absolute top-[calc(100%+10px)] left-0 z-[60] w-[340px] overflow-hidden rounded-2xl border transition-all duration-300 animate-in fade-in slide-in-from-top-2"
                    style={{
                      background: "linear-gradient(175deg, rgba(15,18,30,0.97) 0%, rgba(8,10,18,0.98) 100%)",
                      borderColor: "var(--color-border-default)",
                      boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px var(--color-border-subtle), inset 0 1px 0 var(--color-border-subtle)",
                    }}
                  >
                    {/* Top accent bar */}
                    <div className="h-[2px]" style={{ background: "linear-gradient(90deg, var(--color-primary), #3b82f6, var(--color-primary))" }} />

                    {/* Header */}
                    <div className="flex items-start justify-between px-5 pt-4 pb-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex size-9 items-center justify-center rounded-xl text-sm font-black text-white"
                          style={{
                            backgroundColor: "var(--color-primary)",
                            boxShadow: "0 0 16px var(--color-glow-primary), 0 4px 12px rgba(0,0,0,0.3)",
                          }}
                        >
                          T
                        </span>
                        <div>
                          <h3 className="text-[15px] font-bold" style={{ color: "var(--color-text-primary)" }}>
                            T&apos;SEDA
                          </h3>
                          <p className="text-[11px] font-medium tracking-wide" style={{ color: "var(--color-text-tertiary)" }}>
                            DATA REPOSITORY
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAboutOpen(false)}
                        className="flex size-6 items-center justify-center rounded-md transition-colors hover:bg-white/[0.08]"
                        aria-label="Close"
                      >
                        <X size={14} style={{ color: "var(--color-icon-default)" }} />
                      </button>
                    </div>

                    {/* Divider */}
                    <div className="mx-4 h-px" style={{ background: "var(--color-divider)" }} />

                    {/* Description */}
                    <div className="px-5 py-3.5">
                      <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                        Gamified faculty data collection for{" "}
                        <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                          Thiagarajar College of Engineering
                        </span>
                        , Madurai. Log professional development activities with streaks, timed edit windows, and automated PDF generation.
                      </p>
                    </div>

                    {/* Divider */}
                    <div className="mx-4 h-px" style={{ background: "var(--color-divider)" }} />

                    {/* Feature grid */}
                    <div className="grid grid-cols-2 gap-px p-3" style={{ background: "transparent" }}>
                      {[
                        { icon: Zap, label: "Streak System", desc: "Gamified logging" },
                        { icon: Clock, label: "Timed Edits", desc: "Auto-lock windows" },
                        { icon: FileText, label: "PDF Generation", desc: "Auto snapshots" },
                        { icon: Database, label: "5 Categories", desc: "FDP, Lectures, more" },
                      ].map((feat) => (
                        <div
                          key={feat.label}
                          className="flex items-start gap-2.5 rounded-xl px-3 py-2.5"
                          style={{ background: "var(--color-surface-raised)" }}
                        >
                          <feat.icon
                            size={14}
                            className="mt-0.5 shrink-0"
                            style={{ color: "var(--color-primary)" }}
                          />
                          <div>
                            <p className="text-[11.5px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                              {feat.label}
                            </p>
                            <p className="text-[10.5px]" style={{ color: "var(--color-text-tertiary)" }}>
                              {feat.desc}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Footer */}
                    <div
                      className="flex items-center justify-between px-5 py-3"
                      style={{ background: "var(--color-surface-inset)" }}
                    >
                      <span className="text-[10.5px] font-medium tracking-wide" style={{ color: "var(--color-text-tertiary)" }}>
                        BUILT FOR TCE FACULTY
                      </span>
                      <span className="text-[10.5px] font-mono" style={{ color: "var(--color-text-muted)" }}>
                        v1.0
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Zone divider ── */}
            <div className="h-5 w-px bg-white/[0.12]" />

            {/* ═══ ZONE 2: Context Strip ═══ */}
            <nav aria-label="Main navigation" className="flex flex-1 items-center gap-1 px-3">
              {/* Dashboard pill */}
              <Link
                href={dashboard()}
                className={cn(
                  "relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all duration-200",
                  isActive(dashboard())
                    ? "text-white"
                    : "text-white/40 hover:text-white/70 hover:bg-white/[0.04] hover:-translate-y-px"
                )}
              >
                {isActive(dashboard()) && (
                  <span
                    className="absolute inset-0 rounded-lg"
                    style={{
                      background: `linear-gradient(135deg, ${PAGE_CONTEXT["/dashboard"].accent}18 0%, transparent 100%)`,
                      border: `1px solid ${PAGE_CONTEXT["/dashboard"].accent}25`,
                    }}
                  />
                )}
                <span className="relative flex items-center gap-2">
                  {isActive(dashboard()) && (
                    <span
                      className="size-1.5 rounded-full animate-subtle-pulse"
                      style={{ backgroundColor: PAGE_CONTEXT["/dashboard"].accent }}
                    />
                  )}
                  <LayoutDashboard className="size-3.5" />
                  <span className="hidden md:inline">{t('nav.dashboard')}</span>
                </span>
              </Link>

              {/* Admin pill */}
              {canAccessAdmin && (
                <Link
                  href={adminHome()}
                  className={cn(
                    "relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all duration-200",
                    isActive(adminHome())
                      ? "text-white"
                      : "text-white/40 hover:text-white/70 hover:bg-white/[0.04] hover:-translate-y-px"
                  )}
                >
                  {isActive(adminHome()) && (
                    <span
                      className="absolute inset-0 rounded-lg"
                      style={{
                        background: `linear-gradient(135deg, ${PAGE_CONTEXT["/admin"].accent}18 0%, transparent 100%)`,
                        border: `1px solid ${PAGE_CONTEXT["/admin"].accent}25`,
                      }}
                    />
                  )}
                  <span className="relative flex items-center gap-2">
                    {isActive(adminHome()) && (
                      <span
                        className="size-1.5 rounded-full animate-subtle-pulse"
                        style={{ backgroundColor: PAGE_CONTEXT["/admin"].accent }}
                      />
                    )}
                    <Shield className="size-3.5" />
                    <span className="hidden md:inline">{t('nav.admin')}</span>
                  </span>
                </Link>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Live status — right side of context strip */}
              <div className="hidden items-center gap-2 lg:flex">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-subtle-pulse" />
                <span className="font-mono text-[10px] font-semibold tracking-wider text-white/25">
                  ONLINE
                </span>
              </div>
            </nav>

            {/* ── Zone divider ── */}
            <div className="h-5 w-px bg-white/[0.12]" />

            {/* ═══ ZONE 3: Utility Cluster ═══ */}
            <div className="flex items-center gap-0.5 pl-2 pr-2">
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

          {/* ── Bottom accent line — contextual color with glow ── */}
          <div
            className="h-[1.5px] rounded-b-2xl transition-all duration-500"
            style={{
              background: `linear-gradient(90deg, transparent 5%, ${pageCtx.accent}60 30%, ${pageCtx.accent}60 70%, transparent 95%)`,
              boxShadow: `0 1px 8px ${pageCtx.accent}25, 0 0 2px ${pageCtx.accent}15`,
            }}
          />
        </div>
      </header>

      <Toast toast={toast} position="fixed" />

      {/* ─── Sidebar Drawer ─── */}
      <SidebarDrawer
        open={open}
        onClose={closeMenu}
      />

      {/* ─── Page Content ─── */}
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-6 pt-20 outline-none">{children}</main>
    </div>
  );
}
