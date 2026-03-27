"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Download,
  FileEdit,
  ScrollText,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { type Pill } from "./adminLocalTypes";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { TranslationKey } from "@/lib/i18n";

const ADMIN_ICON_MAP: Record<string, LucideIcon> = {
  BarChart3,
  Download,
  FileEdit,
  ScrollText,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Users,
  Wrench,
};

type AdminPageShellProps = {
  title?: string;
  titleKey?: TranslationKey;
  subtitle?: string;
  subtitleKey?: TranslationKey;
  backHref: string;
  backLabel?: string;
  iconName?: string;
  pills?: Pill[];
  actions?: React.ReactNode;
  /** Extra content rendered inside the gradient header, below title row */
  headerChildren?: React.ReactNode;
  children: React.ReactNode;
  maxWidthClassName?: string;
};

export default function AdminPageShell({
  title,
  titleKey,
  subtitle,
  subtitleKey,
  backHref,
  backLabel = "Admin Console",
  iconName,
  pills,
  actions,
  headerChildren,
  children,
  maxWidthClassName = "max-w-7xl",
}: AdminPageShellProps) {
  const Icon = iconName ? ADMIN_ICON_MAP[iconName] : undefined;
  const { t } = useTranslation();
  const displayTitle = titleKey ? t(titleKey) : title;
  const displaySubtitle = subtitleKey ? t(subtitleKey) : subtitle;

  return (
    <div className={`mx-auto w-full ${maxWidthClassName} px-4 py-8`}>
      <div className="rounded-2xl bg-gradient-to-br from-[var(--color-gradient-from)] to-[var(--color-gradient-to)] p-8 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={backHref}
              className="group mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white/70 transition-all duration-200 hover:bg-white/20 hover:text-white active:scale-95"
            >
              <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
              {backLabel}
            </Link>
            <div className="flex items-center gap-3">
              {Icon && (
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <Icon className="size-5 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-white">{displayTitle}</h1>
                <p className="mt-0.5 text-sm text-white/60">{displaySubtitle}</p>
              </div>
            </div>
            {pills && pills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {pills.map((pill) => (
                  <span
                    key={pill.label}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${pill.color ?? "bg-white/10 text-[var(--color-text-muted)]"}`}
                  >
                    {pill.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {headerChildren}
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}
