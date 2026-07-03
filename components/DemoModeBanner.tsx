"use client";

import { useState } from "react";
import { FlaskConical, LogOut } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

/**
 * DEMO MODE indicator — a floating, unmissable pill pinned bottom-centre on
 * every page while the signed-in user is in demo mode. Deliberately breaks
 * the app's visual pattern (solid warning surface, striped band) so nobody
 * can mistake practice data for real records. Exiting wipes the user's demo
 * data server-side, then hard-reloads so every cache starts clean.
 */
export default function DemoModeBanner() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const exitDemo = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/me/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "exit" }),
      });
      if (res.ok) {
        // Full reload: drops SWR caches and re-renders the layout in the
        // real universe. Failing that, release the button for a retry.
        window.location.href = "/dashboard";
        return;
      }
    } catch {
      // fall through to re-enable
    }
    setBusy(false);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-[70] -translate-x-1/2 animate-fade-in-up"
    >
      <div
        className="flex items-center gap-3 rounded-full border-2 py-1.5 pl-4 pr-1.5 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.45)]"
        style={{
          borderColor: "var(--color-status-warning-border)",
          background:
            "repeating-linear-gradient(45deg, var(--color-status-warning-bg) 0 14px, color-mix(in srgb, var(--color-status-warning) 16%, var(--color-status-warning-bg)) 14px 28px)",
        }}
      >
        <span className="flex items-center gap-2">
          <FlaskConical className="size-4" style={{ color: "var(--color-status-warning)" }} />
          <span
            className="text-xs font-black uppercase tracking-[0.14em]"
            style={{ color: "var(--color-status-warning)" }}
          >
            {t("demo.bannerTitle")}
          </span>
        </span>
        <span
          className="hidden text-xs font-medium sm:block"
          style={{ color: "var(--color-text-secondary)" }}
        >
          {t("demo.bannerNote")}
        </span>
        <button
          type="button"
          onClick={() => void exitDemo()}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-transform duration-150 hover:scale-[1.03] active:scale-95 disabled:opacity-60"
          style={{
            background: "var(--color-status-warning)",
            color: "var(--color-text-on-accent)",
          }}
        >
          <LogOut className="size-3.5" />
          {busy ? t("demo.exiting") : t("demo.exit")}
        </button>
      </div>
    </div>
  );
}
