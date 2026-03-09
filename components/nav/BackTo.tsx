"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { safeBack } from "@/lib/entryNavigation";

/** Derive a human label from a back-navigation href. */
function labelFromHref(href: string): string {
  // /data-entry → "Data Entry"
  if (href === "/data-entry" || href === "/data-entry/") return "Data Entry";
  // /dashboard → "Dashboard"
  if (href === "/dashboard" || href === "/dashboard/") return "Dashboard";
  // /admin → "Admin"
  if (href === "/admin" || href === "/admin/") return "Admin";
  // /data-entry/<category> → prettify slug
  const catMatch = href.match(/^\/data-entry\/([a-z-]+)\/?$/);
  if (catMatch) {
    return catMatch[1]
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  // /admin/<sub> → prettify
  const adminMatch = href.match(/^\/admin\/([a-z-]+)\/?$/);
  if (adminMatch) {
    return adminMatch[1]
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return "Back";
}

export default function BackTo({
  href,
  label,
  disabled = false,
  compact = false,
  onClick,
}: { href: string; label?: string; disabled?: boolean; compact?: boolean; onClick?: (() => void | Promise<void>) | undefined }) {
  const router = useRouter();
  const resolvedLabel = label || labelFromHref(href);

  const handleClick = () => {
    if (disabled) return;
    if (onClick) {
      void onClick();
      return;
    }
    safeBack(router, href);
  };

  const disabledClass =
    "pointer-events-none cursor-not-allowed inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-400 opacity-50";
  const enabledClass =
    "group inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-slate-200 hover:text-slate-900 active:scale-95 cursor-pointer";

  return (
    <button
      type="button"
      aria-label={resolvedLabel}
      disabled={disabled}
      onClick={handleClick}
      className={disabled ? disabledClass : enabledClass}
    >
      <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
      {!compact && <span>{resolvedLabel}</span>}
    </button>
  );
}
