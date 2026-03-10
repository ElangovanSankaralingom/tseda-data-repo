"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import { getCategoryConfig } from "@/data/categoryRegistry";
import { getCategoryIcon } from "@/lib/ui/categoryIcons";
import { type StatusPill } from "./dashboardTypes";

export type CategoryCardData = {
  slug: string;
  label: string;
  href: string;
  total: number;
  draftCount: number;
  generatedCount: number;
  editRequestedCount: number;
  editGrantedCount: number;
};

function CategoryCard({
  slug,
  label,
  href,
  total,
  draftCount,
  generatedCount,
  editRequestedCount,
  editGrantedCount,
}: CategoryCardData) {
  const config = getCategoryConfig(slug);
  const color = config.color;
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const Icon = useMemo(() => getCategoryIcon(config.icon), [config.icon]);
  const accent = { bg: color.bg, iconColor: color.text, ring: color.ring, cta: color.cta };
  const displayCount = useCountUp(total);
  const isEmpty = total === 0;

  const pills: StatusPill[] = [
    { label: "drafts", count: draftCount, className: "bg-slate-100 text-slate-600" },
    { label: "generated", count: generatedCount, className: "bg-blue-100 text-blue-700" },
    { label: "edit requested", count: editRequestedCount, className: "bg-amber-100 text-amber-700" },
    { label: "editable", count: editGrantedCount, className: "bg-emerald-100 text-emerald-700" },
  ].filter((p) => p.count > 0);

  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-xl border p-5 transition-all duration-200 cursor-pointer",
        isEmpty
          ? "border-dashed border-slate-300 bg-slate-50"
          : "border-slate-200 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:ring-2",
        !isEmpty && accent.ring
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex size-10 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110",
          accent.bg
        )}
      >
        {/* eslint-disable-next-line react-hooks/static-components */}
        <Icon className={cn("size-5", accent.iconColor)} />
      </div>

      {/* Count */}
      <div className="mt-3">
        <div
          className={cn(
            "text-3xl font-bold tabular-nums",
            isEmpty ? "text-slate-600" : "text-slate-900"
          )}
        >
          {displayCount}
        </div>
        <div className="text-sm text-slate-600">
          {isEmpty ? label : `${total === 1 ? "entry" : "entries"}`}
        </div>
      </div>

      {/* Status pills or CTA */}
      {isEmpty ? (
        <div className={cn("mt-3 text-xs font-medium", accent.cta)}>
          Start entering data &rarr;
        </div>
      ) : pills.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {pills.map((pill) => (
            <span
              key={pill.label}
              className={cn("rounded-full px-2 py-0.5 text-xs", pill.className)}
            >
              {pill.count} {pill.label}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}

export default React.memo(CategoryCard);
