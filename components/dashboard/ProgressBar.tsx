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
    const timer = setTimeout(() => setBarWidth(pct), 80 + index * 120);
    return () => clearTimeout(timer);
  }, [pct, index]);

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-300",
        "hover:bg-[var(--color-glass-hover)] hover:shadow-sm"
      )}
    >
      <div className="w-28 shrink-0 truncate text-sm font-medium text-[var(--color-text-primary)] sm:w-36">
        {label}
      </div>

      {/* Track */}
      <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--color-glass-bg)] border border-[var(--color-glass-border)]">
        {/* Fill */}
        {barWidth > 0 && (
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)] transition-all duration-700 ease-out"
            style={{ width: `${barWidth}%` }}
          >
            {/* Shimmer sweep */}
            <div
              className="absolute inset-0 overflow-hidden rounded-full"
            >
              <div
                className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-[var(--color-surface-on-accent-strong)] to-transparent"
                style={{ animation: "progressShimmer 2s ease-in-out infinite", animationDelay: `${index * 200}ms` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Count label */}
      <div
        className={cn(
          "w-24 text-right text-xs font-medium tabular-nums transition-colors duration-200",
          isEmpty ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]"
        )}
      >
        {isEmpty ? "Start entering data" : `${count} ${count === 1 ? "entry" : "entries"}`}
      </div>

      <ChevronRight className="size-4 shrink-0 text-[var(--color-text-muted)] opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0.5" />
    </Link>
  );
}
