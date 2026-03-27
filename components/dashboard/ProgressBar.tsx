"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ProgressBar({
  label,
  count,
  maxCount,
  href,
  index,
}: { label: string; count: number; maxCount: number; href: string; index: number }) {
  const [barWidth, setBarWidth] = useState(0);
  const isEmpty = count === 0;
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;

  useEffect(() => {
    const timer = setTimeout(() => setBarWidth(pct), index * 100);
    return () => clearTimeout(timer);
  }, [pct, index]);

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-150",
        "hover:bg-[var(--color-dropdown-hover)]"
      )}
    >
      <div className="w-32 shrink-0 truncate text-sm font-medium text-[var(--color-text-primary)]">
        {label}
      </div>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-skeleton-base)]">
        {barWidth > 0 && (
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-blue-500/15 transition-all duration-500 ease-out"
            style={{ width: `${barWidth}%` }}
          />
        )}
      </div>
      <div
        className={cn(
          "w-20 text-right text-xs font-medium tabular-nums",
          isEmpty ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-secondary)]"
        )}
      >
        {isEmpty ? "Start entering data" : `${count} ${count === 1 ? "entry" : "entries"}`}
      </div>
      <ChevronRight className="size-4 text-[var(--color-text-muted)] opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
    </Link>
  );
}
