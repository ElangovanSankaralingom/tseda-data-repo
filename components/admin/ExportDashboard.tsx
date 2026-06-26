"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  CheckCircle,
  RefreshCw,
  ChevronDown,
  Clock,
} from "lucide-react";
import SelectDropdown from "@/components/controls/SelectDropdown";
import type { ExportTemplate } from "@/lib/export/templates";
import type { ExportHistoryEntry } from "@/lib/export/history";
import { useTranslation } from "@/lib/i18n/useTranslation";
import {
  AnimatedCount,
  FormatSelector,
  HistoryRow,
  TemplateCard,
} from "./ExportDashboardParts";
import { type Option, type PreviewData } from "./adminLocalTypes";

type ColumnFormat = { id: string; label: string; category: string; columns: string[] };

type Props = {
  templates: ExportTemplate[];
  columnFormats: ColumnFormat[];
  users: string[];
  categories: Option[];
  statusOptions: Option[];
  fieldOptionsByCategory: Record<string, Option[]>;
  initialHistory: ExportHistoryEntry[];
};

export default function ExportDashboard({
  templates,
  columnFormats,
  users,
  categories,
  statusOptions,
  fieldOptionsByCategory,
  initialHistory,
}: Props) {
  const { t } = useTranslation();
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
  const [appliedLayoutId, setAppliedLayoutId] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const fieldOptions = useMemo(
    () => fieldOptionsByCategory[selectedCategory] ?? fieldOptionsByCategory["all"] ?? [],
    [selectedCategory, fieldOptionsByCategory]
  );

  const availableLayouts = useMemo(
    () => columnFormats.filter((f) => f.category === selectedCategory),
    [columnFormats, selectedCategory]
  );

  useEffect(() => {
    setSelectedFields(fieldOptions.map((f) => f.key));
    setAppliedLayoutId("");
  }, [fieldOptions]);

  const applyLayout = useCallback(
    (layoutId: string) => {
      setAppliedLayoutId(layoutId);
      if (!layoutId) {
        setSelectedFields(fieldOptions.map((f) => f.key));
        return;
      }
      const layout = availableLayouts.find((l) => l.id === layoutId);
      if (layout) setSelectedFields(layout.columns);
    },
    [availableLayouts, fieldOptions]
  );

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
    if (selectedFields.length > 0 && (appliedLayoutId !== "" || selectedFields.length < fieldOptions.length)) {
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
  }, [allUsers, selectedUser, selectedCategory, format, selectedFields, fieldOptions, appliedLayoutId, selectedStatuses, fromDate, toDate, users]);

  function toggleStatus(status: string) {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  }

  function toggleField(key: string) {
    setAppliedLayoutId("");
    setSelectedFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3">
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">{t("adminExport.quickExports")}</div>
          <div className="text-xs text-[var(--color-text-secondary)]">{t("adminExport.quickExportsDesc")}</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((tpl, i) => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              index={i}
              onExport={handleTemplateExport}
              running={runningTemplate === tpl.id}
            />
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-card-bg)] p-6 animate-fade-in-up">
        <div className="mb-5">
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">{t("adminExport.customExport")}</div>
          <div className="text-xs text-[var(--color-text-secondary)]">{t("adminExport.customExportDesc")}</div>
        </div>

        <div className="space-y-5">
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">{t("adminExport.format")}</div>
            <FormatSelector value={format} onChange={setFormat} />
          </div>

          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">{t("adminExport.scope")}</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAllUsers(true)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                  allUsers ? "bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-text)]" : "bg-[var(--color-dropdown-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-dropdown-hover)]"
                }`}
              >
                {t("adminExport.allUsers")}
              </button>
              <button
                type="button"
                onClick={() => setAllUsers(false)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                  !allUsers ? "bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-text)]" : "bg-[var(--color-dropdown-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-dropdown-hover)]"
                }`}
              >
                {t("adminExport.specificUser")}
              </button>
            </div>
            {!allUsers ? (
              <div className="mt-2 max-w-sm">
                <SelectDropdown
                  value={selectedUser}
                  onChange={(value) => setSelectedUser(value)}
                  options={users.map((u) => ({ label: u, value: u }))}
                  placeholder={t("adminExport.selectUser")}
                />
              </div>
            ) : null}
            <div className="mt-3 max-w-sm">
              <SelectDropdown
                value={selectedCategory}
                onChange={(value) => setSelectedCategory(value)}
                options={categories.map((c) => ({ label: c.label, value: c.key }))}
                placeholder={t("adminExport.selectCategory")}
              />
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowFilters((p) => !p)}
              className="flex items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              <ChevronDown className={`size-3.5 transition-transform duration-200 ${showFilters ? "rotate-0" : "-rotate-90"}`} />
              {t("adminExport.addFiltersOptional")}
            </button>
            {showFilters ? (
              <div className="mt-3 space-y-3 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-card-bg)] p-4">
                <div>
                  <div className="mb-1 text-xs text-[var(--color-text-secondary)]">{t("adminExport.status")}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {statusOptions.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => toggleStatus(s.key)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
                          selectedStatuses.includes(s.key)
                            ? "bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-text)]"
                            : "bg-[var(--color-dropdown-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-dropdown-hover)]"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-xs">
                    <span className="text-[var(--color-text-secondary)]">{t("adminExport.fromDate")}</span>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="h-9 w-full rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input-bg)] px-3 text-sm"
                    />
                  </label>
                  <label className="space-y-1 text-xs">
                    <span className="text-[var(--color-text-secondary)]">{t("adminExport.toDate")}</span>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="h-9 w-full rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input-bg)] px-3 text-sm"
                    />
                  </label>
                </div>
              </div>
            ) : null}
          </div>

          {availableLayouts.length > 0 ? (
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">{t("adminExport.columnLayout")}</div>
              <div className="max-w-sm">
                <SelectDropdown
                  value={appliedLayoutId}
                  onChange={(value) => applyLayout(value)}
                  options={[
                    { label: t("adminExport.columnLayoutDefault"), value: "" },
                    ...availableLayouts.map((l) => ({ label: l.label, value: l.id })),
                  ]}
                />
              </div>
              <div className="mt-1.5 text-xs text-[var(--color-text-secondary)]">{t("adminExport.columnLayoutHint")}</div>
            </div>
          ) : null}

          <div>
            <button
              type="button"
              onClick={() => setShowFields((p) => !p)}
              className="flex items-center gap-1 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              <ChevronDown className={`size-3.5 transition-transform duration-200 ${showFields ? "rotate-0" : "-rotate-90"}`} />
              {t("adminExport.chooseFields")} ({selectedFields.length}/{fieldOptions.length})
            </button>
            {showFields ? (
              <div className="mt-3 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-card-bg)] p-4">
                <div className="mb-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setAppliedLayoutId(""); setSelectedFields(fieldOptions.map((f) => f.key)); }}
                    className="text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-light)]"
                  >
                    {t("adminExport.selectAll")}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAppliedLayoutId(""); setSelectedFields([]); }}
                    className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  >
                    {t("adminExport.clear")}
                  </button>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {fieldOptions.map((f) => (
                    <label key={f.key} className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
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

          <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-card-bg)] p-4">
            {loadingPreview ? (
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                <RefreshCw className="size-3 animate-spin" /> {t("adminExport.loadingPreview")}
              </div>
            ) : preview ? (
              <div className="space-y-2">
                <div className="text-sm text-[var(--color-text-primary)]">
                  {t("adminExport.previewIntro")} <span className="font-semibold"><AnimatedCount value={preview.recordCount} /></span> {t("adminExport.entriesWord")}
                  {" "}{t("adminExport.fromWord")} <span className="font-semibold">{preview.userCount}</span> {preview.userCount !== 1 ? t("adminExport.usersWord") : t("adminExport.userWord")}
                </div>
                {Object.keys(preview.statusBreakdown).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(preview.statusBreakdown).map(([status, count]) => (
                      <span key={status} className="rounded-full bg-[var(--color-dropdown-hover)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
                        {status}: {count}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-xs text-[var(--color-text-secondary)]">{t("adminExport.previewEmpty")}</div>
            )}
          </div>

          <button
            type="button"
            disabled={exporting || !preview || preview.recordCount === 0}
            onClick={handleCustomExport}
            className={`w-full rounded-xl px-6 py-3 text-sm font-medium shadow-lg transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${
              exportSuccess
                ? "bg-[var(--color-generate-bg)] text-[var(--color-button-primary-text)]"
                : "bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-text)] hover:bg-[var(--color-button-primary-hover)]"
            }`}
          >
            {exporting ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="size-4 animate-spin" /> {t("adminExport.generatingExport")}
              </span>
            ) : exportSuccess ? (
              <span className="flex items-center justify-center gap-2">
                <CheckCircle className="size-4" /> {t("adminExport.downloaded")}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Download className="size-4" />
                {t("adminExport.exportEntriesAs").replace("{count}", String(preview?.recordCount ?? 0)).replace("{format}", format.toUpperCase())}
              </span>
            )}
          </button>
        </div>
      </div>

      {history.length > 0 ? (
        <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-card-bg)] p-5 animate-fade-in-up">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
            <Clock className="size-4 text-[var(--color-text-secondary)]" />
            {t("adminExport.recentExports")}
          </div>
          {history.map((entry, i) => (
            <HistoryRow key={`${entry.id}-${i}`} entry={entry} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--color-border-default)] bg-[var(--color-surface-inset)] p-6 text-center animate-fade-in-up">
          <div className="text-sm text-[var(--color-text-secondary)]">{t("adminExport.noExportsYet")}</div>
        </div>
      )}
    </div>
  );
}
