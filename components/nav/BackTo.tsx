"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { safeBack } from "@/lib/entryNavigation";
import { useTranslation } from "@/lib/i18n/useTranslation";

function useLabelFromHref(href: string): string {
  const { t, categoryLabel } = useTranslation();
  if (href === "/data-entry" || href === "/data-entry/") return t("nav.dataEntry");
  if (href === "/dashboard" || href === "/dashboard/") return t("nav.dashboard");
  if (href === "/admin" || href === "/admin/") return t("nav.admin");
  const catMatch = href.match(/^\/data-entry\/([a-z-]+)\/?$/);
  if (catMatch) {
    return categoryLabel(catMatch[1]);
  }
  const adminMatch = href.match(/^\/admin\/([a-z-]+)\/?$/);
  if (adminMatch) {
    return adminMatch[1]
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return t("common.back");
}

export default function BackTo({
  href,
  label,
  disabled = false,
  compact = false,
  onClick,
}: { href: string; label?: string; disabled?: boolean; compact?: boolean; onClick?: (() => void | Promise<void>) | undefined }) {
  const router = useRouter();
  const derivedLabel = useLabelFromHref(href);
  const resolvedLabel = label || derivedLabel;

  const handleClick = () => {
    if (disabled) return;
    if (onClick) {
      void onClick();
      return;
    }
    safeBack(router, href);
  };

  const disabledClass =
    "pointer-events-none cursor-not-allowed inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 opacity-50";
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
