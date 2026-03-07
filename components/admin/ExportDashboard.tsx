"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Braces,
  CheckCircle,
  BarChart3,
  Calendar,
  FileWarning,
  RefreshCw,
  Clock,
  ChevronDown,
} from "lucide-react";
import type { ExportTemplate } from "@/lib/export/templates";
import type { ExportHistoryEntry } from "@/lib/export/history";
import { useCountUp } from "@/hooks/useCountUp";

type Option = { key: string; label: string };

type Props = {
  templates: ExportTemplate[];
  users: string[];
  categories: Option[];
  statusOptions: Option[];
  fieldOptionsByCategory: Record<string, Option[]>;
  initialHistory: ExportHistoryEntry[];
};

type PreviewData = {
  recordCount: number;
  userCount: number;
  categoryBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
};

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

function formatTimeAgo(isoString: string) {
  const ms = Date.now() - Date.parse(isoString);
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function FormatBadge({ format }: { format: string }) {
  const info = FORMAT_BADGE[format] ?? FORMAT_BADGE.csv;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${info.bg}`}>
      {info.label}
    </span>
  );
}

function AnimatedCount({ value }: { value: number }) {
  const animated = useCountUp(value);
  return <>{animated.toLocaleString("en-IN")}</>;
}

// ---------- Template Card ----------

function TemplateCard({
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
  const iconBg = TEMPLATE_ICON_BG[template.icon] ?? "bg-slate-50 text-slate-600";

  return (
    <div className={`group rounded-xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md animate-fade-in-up stagger-${Math.min(index + 1, 8)}`}>
      <div className="flex items-start gap-3">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${iconBg} transition-transform duration-200 group-hover:scale-110`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-800">{template.name}</div>
          <div className="mt-0.5 text-xs text-slate-500">{template.description}</div>
          <div className="mt-0.5 text-xs italic text-slate-400">{template.funSubtitle}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <FormatBadge format={template.config.format} />
        <button
          type="button"
          disabled={running}
          onClick={() => onExport(template.id)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition-all duration-150 hover:bg-slate-100 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
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

// ---------- Format Selector ----------

function FormatSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
              ? "border-slate-900 bg-slate-50 ring-2 ring-slate-900"
              : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
            {fmt.icon} {fmt.label}
          </div>
          <div className="mt-1 text-xs text-slate-400">{fmt.sub}</div>
        </button>
      ))}
    </div>
  );
}

// ---------- History Row ----------

function HistoryRow({ entry }: { entry: ExportHistoryEntry }) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 px-1 py-2.5 last:border-0">
      <FormatBadge format={entry.format} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-700">
          {entry.templateId ?? entry.scope} &middot; {entry.category}
        </div>
        <div className="text-xs text-slate-400">
          {entry.recordCount} entries &middot; {formatBytes(entry.fileSize)} &middot; {entry.durationMs}ms
        </div>
      </div>
      <div className="text-xs text-slate-400">{formatTimeAgo(entry.createdAt)}</div>
    </div>
  );
}

// ---------- Main Dashboard ----------

export default function ExportDashboard({
  templates,
  users,
  categories,
  statusOptions,
  fieldOptionsByCategory,
  initialHistory,
}: Props) {
  // Template state
  const [runningTemplate, setRunningTemplate] = useState<string | null>(null);
  const [history, setHistory] = useState(initialHistory);

  // Builder state
  const [format, setFormat] = useState("xlsx");
  const [allUsers, setAllUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState(users[0] ?? "");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showFields, setShowFields] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const fieldOptions = useMemo(
    () => fieldOptionsByCategory[selectedCategory] ?? fieldOptionsByCategory["all"] ?? [],
    [selectedCategory, fieldOptionsByCategory]
  );

  // Reset fields when category changes
  useEffect(() => {
    setSelectedFields(fieldOptions.map((f) => f.key));
  }, [fieldOptions]);

  // Fetch preview (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchPreview();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allUsers, selectedUser, selectedCategory, selectedStatuses, fromDate, toDate]);

  const fetchPreview = useCallback(async () => {
    setLoadingPreview(true);
    try {
      const params = new URLSearchParams();
      if (allUsers) {
        params.set("allUsers", "true");
      } else if (selectedUser) {
        params.set("userEmail", selectedUser);
      }
      params.set("category", selectedCategory);
      if (selectedStatuses.length > 0) params.set("statuses", selectedStatuses.join(","));
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const res = await fetch(`/api/admin/export/preview?${params.toString()}`);
      const body = await res.json() as { data?: PreviewData };
      if (body.data) setPreview(body.data);
    } catch {
      // Ignore preview errors
    } finally {
      setLoadingPreview(false);
    }
  }, [allUsers, selectedUser, selectedCategory, selectedStatuses, fromDate, toDate]);

  const handleTemplateExport = useCallback(async (templateId: string) => {
    setRunningTemplate(templateId);
    try {
      // Trigger download
      window.location.assign(`/api/admin/export/template/${templateId}`);
      // Wait a bit then refresh history
      await new Promise((r) => setTimeout(r, 2000));
      const res = await fetch("/api/admin/export/history");
      const body = await res.json() as { data?: ExportHistoryEntry[] };
      if (body.data) setHistory(body.data);
    } finally {
      setRunningTemplate(null);
    }
  }, []);

  const handleCustomExport = useCallback(() => {
    setExporting(true);
    setExportSuccess(false);

    const params = new URLSearchParams();
    if (!allUsers && selectedUser) {
      params.set("userEmail", selectedUser);
    }
    // For all-users, we use the first user as a fallback (the existing API requires userEmail)
    if (allUsers) {
      params.set("userEmail", users[0] ?? "");
    }
    params.set("category", selectedCategory);
    params.set("format", format === "json" ? "csv" : format); // JSON handled differently
    if (selectedFields.length > 0 && selectedFields.length < fieldOptions.length) {
      params.set("fields", selectedFields.join(","));
    }
    if (selectedStatuses.length > 0) params.set("statuses", selectedStatuses.join(","));
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);

    window.location.assign(`/api/admin/export/entries?${params.toString()}`);

    // Show success after a delay
    setTimeout(() => {
      setExporting(false);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 2000);
    }, 1500);
  }, [allUsers, selectedUser, selectedCategory, format, selectedFields, fieldOptions, selectedStatuses, fromDate, toDate, users]);

  function toggleStatus(status: string) {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  }

  function toggleField(key: string) {
    setSelectedFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Export Templates */}
      <div>
        <div className="mb-3">
          <div className="text-sm font-semibold text-slate-800">Quick Exports</div>
          <div className="text-xs text-slate-400">One-click exports for common needs</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t, i) => (
            <TemplateCard
              key={t.id}
              template={t}
              index={i}
              onExport={handleTemplateExport}
              running={runningTemplate === t.id}
            />
          ))}
        </div>
      </div>

      {/* Custom Export Builder */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 animate-fade-in-up">
        <div className="mb-5">
          <div className="text-sm font-semibold text-slate-800">Custom Export</div>
          <div className="text-xs text-slate-400">Build exactly the export you need</div>
        </div>

        <div className="space-y-5">
          {/* Step 1: Format */}
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Format</div>
            <FormatSelector value={format} onChange={setFormat} />
          </div>

          {/* Step 2: Scope */}
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Scope</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAllUsers(true)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                  allUsers ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All Users
              </button>
              <button
                type="button"
                onClick={() => setAllUsers(false)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                  !allUsers ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Specific User
              </button>
            </div>
            {!allUsers ? (
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="mt-2 h-10 w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                {users.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            ) : null}
            <div className="mt-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-10 w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Step 3: Filters (collapsible) */}
          <div>
            <button
              type="button"
              onClick={() => setShowFilters((p) => !p)}
              className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              <ChevronDown className={`size-3.5 transition-transform duration-200 ${showFilters ? "rotate-0" : "-rotate-90"}`} />
              Add Filters (optional)
            </button>
            {showFilters ? (
              <div className="mt-3 space-y-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <div>
                  <div className="mb-1 text-xs text-slate-500">Status</div>
                  <div className="flex flex-wrap gap-1.5">
                    {statusOptions.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => toggleStatus(s.key)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
                          selectedStatuses.includes(s.key)
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-xs">
                    <span className="text-slate-500">From Date</span>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="text-slate-500">To Date</span>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                    />
                  </label>
                </div>
              </div>
            ) : null}
          </div>

          {/* Step 4: Fields (collapsible) */}
          <div>
            <button
              type="button"
              onClick={() => setShowFields((p) => !p)}
              className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              <ChevronDown className={`size-3.5 transition-transform duration-200 ${showFields ? "rotate-0" : "-rotate-90"}`} />
              Choose Fields ({selectedFields.length}/{fieldOptions.length})
            </button>
            {showFields ? (
              <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <div className="mb-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedFields(fieldOptions.map((f) => f.key))}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedFields([])}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    Clear
                  </button>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {fieldOptions.map((f) => (
                    <label key={f.key} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={selectedFields.includes(f.key)}
                        onChange={() => toggleField(f.key)}
                        className="size-3.5"
                      />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* Step 5: Preview + Export */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            {loadingPreview ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <RefreshCw className="size-3 animate-spin" /> Loading preview...
              </div>
            ) : preview ? (
              <div className="space-y-2">
                <div className="text-sm text-slate-700">
                  This export will include <span className="font-semibold"><AnimatedCount value={preview.recordCount} /></span> entries
                  from <span className="font-semibold">{preview.userCount}</span> user{preview.userCount !== 1 ? "s" : ""}
                </div>
                {Object.keys(preview.statusBreakdown).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(preview.statusBreakdown).map(([status, count]) => (
                      <span key={status} className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                        {status}: {count}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-xs text-slate-400">Select options above to see a preview</div>
            )}
          </div>

          <button
            type="button"
            disabled={exporting || !preview || preview.recordCount === 0}
            onClick={handleCustomExport}
            className={`w-full rounded-xl px-6 py-3 text-sm font-medium shadow-lg transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${
              exportSuccess
                ? "bg-emerald-600 text-white"
                : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            {exporting ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="size-4 animate-spin" /> Generating export...
              </span>
            ) : exportSuccess ? (
              <span className="flex items-center justify-center gap-2">
                <CheckCircle className="size-4" /> Downloaded!
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Download className="size-4" />
                Export {preview?.recordCount ?? 0} Entries as {format.toUpperCase()}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Export History */}
      {history.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 animate-fade-in-up">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Clock className="size-4 text-slate-400" />
            Recent Exports
          </div>
          {history.map((entry, i) => (
            <HistoryRow key={`${entry.id}-${i}`} entry={entry} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center animate-fade-in-up">
          <div className="text-sm text-slate-400">No exports yet — create your first one above!</div>
        </div>
      )}
    </div>
  );
}
