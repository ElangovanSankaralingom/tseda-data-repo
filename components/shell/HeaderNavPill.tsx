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
  dotColor = "bg-amber-500/15",
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
          ? "bg-[var(--color-button-primary-bg)] text-white shadow-sm"
          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-dropdown-hover)]"
      )}
    >
      <Icon className="size-4" />
      <span>{label}</span>
      {hasDot && (
        <span className={cn("size-1.5 rounded-full animate-subtle-pulse", dotColor)} />
      )}
      {active && (
        <span className="absolute -bottom-2.5 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-[var(--color-button-primary-bg)]" />
      )}
    </Link>
  );
}
