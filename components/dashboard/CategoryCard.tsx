"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  FileSearch,
  Mic,
  Presentation,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";

type CategoryAccent = {
  icon: LucideIcon;
  bg: string;
  iconColor: string;
  ring: string;
  cta: string;
};

const CATEGORY_ACCENTS: Record<string, CategoryAccent> = {
  "fdp-attended": {
    icon: BookOpen,
    bg: "bg-blue-100",
    iconColor: "text-blue-600",
    ring: "hover:ring-blue-200",
    cta: "text-blue-500",
  },
  "fdp-conducted": {
    icon: Presentation,
    bg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    ring: "hover:ring-emerald-200",
    cta: "text-emerald-500",
  },
  "case-studies": {
    icon: FileSearch,
    bg: "bg-purple-100",
    iconColor: "text-purple-600",
    ring: "hover:ring-purple-200",
    cta: "text-purple-500",
  },
  "guest-lectures": {
    icon: Mic,
    bg: "bg-amber-100",
    iconColor: "text-amber-600",
    ring: "hover:ring-amber-200",
    cta: "text-amber-500",
  },
  workshops: {
    icon: Wrench,
    bg: "bg-rose-100",
    iconColor: "text-rose-600",
    ring: "hover:ring-rose-200",
    cta: "text-rose-500",
  },
};

const DEFAULT_ACCENT: CategoryAccent = {
  icon: BookOpen,
  bg: "bg-slate-100",
  iconColor: "text-slate-600",
  ring: "hover:ring-slate-200",
  cta: "text-slate-500",
};

type StatusPill = {
  label: string;
  count: number;
  className: string;
};

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

export default function CategoryCard({
  slug,
  label,
  href,
  total,
  draftCount,
  generatedCount,
  editRequestedCount,
  editGrantedCount,
}: CategoryCardData) {
  const accent = CATEGORY_ACCENTS[slug] ?? DEFAULT_ACCENT;
  const Icon = accent.icon;
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
        <Icon className={cn("size-5", accent.iconColor)} />
      </div>

      {/* Count */}
      <div className="mt-3">
        <div
          className={cn(
            "text-3xl font-bold tabular-nums",
            isEmpty ? "text-slate-400" : "text-slate-900"
          )}
        >
          {displayCount}
        </div>
        <div className="text-sm text-slate-500">
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
