"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function HeaderNavPill({
  href,
  icon: Icon,
  label,
  active,
  hasDot,
  dotColor = "bg-[var(--color-badge-bg)]",
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
        "relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200",
        active
          ? // Full accent pill — same "you are here" treatment as the
            // settings sidebar and dashboard group tabs, unmistakable in
            // both modes. The glow gives it a soft accent halo on dark.
            "bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-text)] shadow-[0_0_12px_var(--color-glow-primary)]"
          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-dropdown-hover)]"
      )}
    >
      <Icon className="size-4" />
      <span>{label}</span>
      {hasDot && (
        <span
          className={cn(
            "size-1.5 rounded-full animate-subtle-pulse glow-dot",
            // On the solid accent pill the themed dot would vanish — flip to
            // an on-accent surface so it stays visible.
            active ? "bg-[var(--color-surface-on-accent-strong)]" : dotColor,
          )}
        />
      )}
    </Link>
  );
}
