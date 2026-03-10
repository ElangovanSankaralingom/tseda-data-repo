"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  CheckCircle,
  RefreshCw,
  ChevronDown,
  Clock,
} from "lucide-react";
import type { ExportTemplate } from "@/lib/export/templates";
import type { ExportHistoryEntry } from "@/lib/export/history";
import {
  AnimatedCount,
  FormatSelector,
  HistoryRow,
  TemplateCard,
} from "./ExportDashboardParts";
import { type Option, type PreviewData } from "./adminLocalTypes";

type Props = {
  templates: ExportTemplate[];
  users: string[];
  categories: Option[];
  statusOptions: Option[];
  fieldOptionsByCategory: Record<string, Option[]>;
  initialHistory: ExportHistoryEntry[];
};

export default function ExportDashboard({
  templates,
  users,
  categories,
  statusOptions,
  fieldOptionsByCategory,
  initialHistory,
}: Props) {
  const [runningTemplate, setRunningTemplate] = useState<string | null>(null);
  const [history, setHistory] = useState(initialHistory);
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

  useEffect(() => {
    setSelectedFields(fieldOptions.map((f) => f.key));
  }, [fieldOptions]);

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
      window.location.assign(`/api/admin/export/template/${templateId}`);
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
    if (allUsers) {
      params.set("userEmail", users[0] ?? "");
    }
    params.set("category", selectedCategory);
    params.set("format", format === "json" ? "csv" : format);
    if (selectedFields.length > 0 && selectedFields.length < fieldOptions.length) {
      params.set("fields", selectedFields.join(","));
    }
    if (selectedStatuses.length > 0) params.set("statuses", selectedStatuses.join(","));
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);

    window.location.assign(`/api/admin/export/entries?${params.toString()}`);

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
      <div>
        <div className="mb-3">
          <div className="text-sm font-semibold text-slate-800">Quick Exports</div>
          <div className="text-xs text-slate-500">One-click exports for common needs</div>
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

      <div className="rounded-2xl border border-slate-200 bg-white p-6 animate-fade-in-up">
        <div className="mb-5">
          <div className="text-sm font-semibold text-slate-800">Custom Export</div>
          <div className="text-xs text-slate-500">Build exactly the export you need</div>
        </div>

        <div className="space-y-5">
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Format</div>
            <FormatSelector value={format} onChange={setFormat} />
          </div>

          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Scope</div>
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
                aria-label="Select user"
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
                aria-label="Select category"
                className="h-10 w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

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

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            {loadingPreview ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
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
              <div className="text-xs text-slate-500">Select options above to see a preview</div>
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

      {history.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 animate-fade-in-up">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Clock className="size-4 text-slate-500" />
            Recent Exports
          </div>
          {history.map((entry, i) => (
            <HistoryRow key={`${entry.id}-${i}`} entry={entry} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center animate-fade-in-up">
          <div className="text-sm text-slate-500">No exports yet — create your first one above!</div>
        </div>
      )}
    </div>
  );
}
