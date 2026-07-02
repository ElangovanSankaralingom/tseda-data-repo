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
          ? // primary/15 equals dark mode's badge-bg exactly, and gives light
            // mode a REAL indigo tint (badge-bg is #E5E7FA there — invisible
            // on the white header). The inset ring defines the pill edge in
            // both modes; the glow only reads on dark, which is fine.
            "bg-[var(--color-primary)]/15 text-[var(--color-badge-text)] ring-1 ring-inset ring-[var(--color-primary)]/25 shadow-[0_0_12px_var(--color-glow-primary)]"
          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-dropdown-hover)]"
      )}
    >
      <Icon className="size-4" />
      <span>{label}</span>
      {hasDot && (
        <span className={cn("size-1.5 rounded-full animate-subtle-pulse glow-dot", dotColor)} />
      )}
    </Link>
  );
}
