"use client";

import {
  Download,
  FileSpreadsheet,
  Braces,
  CheckCircle,
  BarChart3,
  Calendar,
  FileWarning,
  RefreshCw,
} from "lucide-react";
import type { ExportTemplate } from "@/lib/export/templates";
import type { ExportHistoryEntry } from "@/lib/export/history";
import { useCountUp } from "@/hooks/useCountUp";
import { formatNumber } from "@/lib/i18n/locale";

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  CheckCircle: <CheckCircle className="size-5" />,
  BarChart3: <BarChart3 className="size-5" />,
  Calendar: <Calendar className="size-5" />,
  FileWarning: <FileWarning className="size-5" />,
};

const TEMPLATE_ICON_BG: Record<string, string> = {
  CheckCircle: "bg-emerald-50 text-emerald-600",
  BarChart3: "bg-blue-50 text-blue-600",
  Calendar: "bg-violet-50 text-violet-600",
  FileWarning: "bg-amber-50 text-amber-600",
};

const FORMAT_BADGE: Record<string, { bg: string; label: string }> = {
  xlsx: { bg: "bg-emerald-100 text-emerald-700", label: "XLSX" },
  csv: { bg: "bg-blue-100 text-blue-700", label: "CSV" },
  json: { bg: "bg-violet-100 text-violet-700", label: "JSON" },
};

export function formatTimeAgo(isoString: string) {
  const ms = Date.now() - Date.parse(isoString);
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function FormatBadge({ format }: { format: string }) {
  const info = FORMAT_BADGE[format] ?? FORMAT_BADGE.csv;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${info.bg}`}>
      {info.label}
    </span>
  );
}

export function AnimatedCount({ value }: { value: number }) {
  const animated = useCountUp(value);
  return <>{formatNumber(animated, "en")}</>;
}

export function TemplateCard({
  template,
  index,
  onExport,
  running,
}: {
  template: ExportTemplate;
  index: number;
  onExport: (id: string) => void;
  running: boolean;
}) {
  const icon = TEMPLATE_ICONS[template.icon] ?? <Download className="size-5" />;
  const iconBg = TEMPLATE_ICON_BG[template.icon] ?? "bg-[var(--color-body-bg)] text-[var(--color-text-secondary)]";

  return (
    <div className={`group rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md animate-fade-in-up stagger-${Math.min(index + 1, 8)}`}>
      <div className="flex items-start gap-3">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${iconBg} transition-transform duration-200 group-hover:scale-110`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">{template.name}</div>
          <div className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{template.description}</div>
          <div className="mt-0.5 text-xs italic text-[var(--color-text-secondary)]">{template.funSubtitle}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <FormatBadge format={template.config.format} />
        <button
          type="button"
          disabled={running}
          onClick={() => onExport(template.id)}
          className="rounded-lg border border-[var(--color-card-border)] bg-[var(--color-body-bg)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-all duration-150 hover:bg-[var(--color-dropdown-hover)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? (
            <span className="flex items-center gap-1.5">
              <RefreshCw className="size-3 animate-spin" /> Generating...
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Download className="size-3" /> Export
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

export function FormatSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const formats = [
    { key: "xlsx", label: "Excel", sub: "Opens in Excel, Google Sheets", icon: <FileSpreadsheet className="size-5" /> },
    { key: "csv", label: "CSV", sub: "Universal spreadsheet format", icon: <FileSpreadsheet className="size-5" /> },
    { key: "json", label: "JSON", sub: "Structured data for developers", icon: <Braces className="size-5" /> },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {formats.map((fmt) => (
        <button
          key={fmt.key}
          type="button"
          onClick={() => onChange(fmt.key)}
          className={`rounded-xl border p-4 text-left transition-all duration-200 ${
            value === fmt.key
              ? "border-[var(--color-text-primary)] bg-[var(--color-body-bg)] ring-2 ring-[var(--color-text-primary)]"
              : "border-[var(--color-card-border)] hover:border-[var(--color-text-muted)]"
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
            {fmt.icon} {fmt.label}
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-secondary)]">{fmt.sub}</div>
        </button>
      ))}
    </div>
  );
}

export function HistoryRow({ entry }: { entry: ExportHistoryEntry }) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--color-divider)] px-1 py-2.5 last:border-0">
      <FormatBadge format={entry.format} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[var(--color-text-secondary)]">
          {entry.templateId ?? entry.scope} &middot; {entry.category}
        </div>
        <div className="text-xs text-[var(--color-text-secondary)]">
          {entry.recordCount} entries &middot; {formatBytes(entry.fileSize)} &middot; {entry.durationMs}ms
        </div>
      </div>
      <div className="text-xs text-[var(--color-text-secondary)]">{formatTimeAgo(entry.createdAt)}</div>
    </div>
  );
}
