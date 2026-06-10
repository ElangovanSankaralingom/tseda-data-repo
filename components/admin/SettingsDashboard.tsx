"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Globe,
  Lock,
  FileEdit,
  Flame,
  Wrench,
  Palette,
  Terminal,
  Search,
  RotateCcw,
  Download,
  Upload,
  ChevronRight,
  Clock,
  X,
} from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { SettingCategory, SettingWithMeta, ChangeLogEntry } from "./settings/SettingsTypes";
import { SettingRow } from "./settings/SettingsControls";
import { useTranslation } from "@/lib/i18n/useTranslation";

// ---------------------------------------------------------------------------
// Types (local)
// ---------------------------------------------------------------------------

type Props = {
  initialSettings: SettingWithMeta[];
  initialCounts: Record<string, number>;
};

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<SettingCategory, typeof Globe> = {
  general: Globe,
  auth: Lock,
  entries: FileEdit,
  streaks: Flame,
  maintenance: Wrench,
  appearance: Palette,
  advanced: Terminal,
};

// CATEGORY_META is now defined inside the component to support i18n

const CATEGORY_ORDER: SettingCategory[] = ["general", "auth", "entries", "streaks", "maintenance", "appearance", "advanced"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelative(ts: string): string {
  const diff = Date.now() - Date.parse(ts);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function emailName(email: string): string {
  return email.split("@")[0] || email;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SettingsDashboard({ initialSettings, initialCounts }: Props) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState(initialSettings);
  const [counts, setCounts] = useState(initialCounts);
  const [activeCategory, setActiveCategory] = useState<SettingCategory>("general");
  const [search, setSearch] = useState("");
  const [changelog, setChangelog] = useState<ChangeLogEntry[]>([]);
  const [showChangelog, setShowChangelog] = useState(false);
  const [resetAllOpen, setResetAllOpen] = useState(false);

  const CATEGORY_META: Record<SettingCategory, { label: string; description: string }> = useMemo(() => ({
    general: { label: t("adminSettingsPage.general"), description: t("adminSettingsPage.generalDesc") },
    auth: { label: t("adminSettingsPage.authentication"), description: t("adminSettingsPage.authDesc") },
    entries: { label: t("adminSettingsPage.entriesWindows"), description: t("adminSettingsPage.entriesWindowsDesc") },
    streaks: { label: t("adminSettingsPage.streaks"), description: t("adminSettingsPage.streaksDesc") },
    maintenance: { label: t("adminSettingsPage.maintenance"), description: t("adminSettingsPage.maintenanceDesc") },
    appearance: { label: t("adminSettingsPage.appearance"), description: t("adminSettingsPage.appearanceDesc") },
    advanced: { label: t("adminSettingsPage.advanced"), description: t("adminSettingsPage.advancedDesc") },
  }), [t]);

  // Group settings by category
  const byCategory = useMemo(() => {
    const map = new Map<SettingCategory, SettingWithMeta[]>();
    for (const s of settings) {
      const list = map.get(s.definition.category) ?? [];
      list.push(s);
      map.set(s.definition.category, list);
    }
    return map;
  }, [settings]);

  // Filtered settings (search)
  const filteredSettings = useMemo(() => {
    if (!search.trim()) {
      return byCategory.get(activeCategory) ?? [];
    }
    const q = search.toLowerCase();
    return settings.filter(
      (s) =>
        s.definition.label.toLowerCase().includes(q) ||
        s.definition.description.toLowerCase().includes(q) ||
        s.definition.key.toLowerCase().includes(q)
    );
  }, [settings, search, activeCategory, byCategory]);

  // Group filtered by group field
  const grouped = useMemo(() => {
    const groups = new Map<string, SettingWithMeta[]>();
    for (const s of filteredSettings) {
      const group = s.definition.group ?? t("adminSettingsPage.other");
      const list = groups.get(group) ?? [];
      list.push(s);
      groups.set(group, list);
    }
    return groups;
  }, [filteredSettings, t]);

  // Refresh from server
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const body = await res.json();
        if (body.data) {
          setSettings(body.data.settings);
          setCounts(body.data.counts);
        }
      }
    } catch {
      // silent
    }
  }, []);

  // Save a setting
  const handleSave = useCallback(async (key: string, value: unknown, confirmed = false): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value, confirmed }),
      });
      if (res.status === 409) {
        // needs confirmation — let SettingRow handle it
        return false;
      }
      if (!res.ok) return false;
      await refresh();
      return true;
    } catch {
      return false;
    }
  }, [refresh]);

  // Reset a setting
  const handleReset = useCallback(async (key: string) => {
    try {
      await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          value: settings.find((s) => s.definition.key === key)?.definition.default,
        }),
      });
      await refresh();
    } catch {
      // silent
    }
  }, [refresh, settings]);

  // Reset all
  const handleResetAll = useCallback(async () => {
    setResetAllOpen(false);
    try {
      await fetch("/api/admin/settings/reset-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      });
      await refresh();
    } catch {
      // silent
    }
  }, [refresh]);

  // Load changelog
  const loadChangelog = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings/changelog");
      if (res.ok) {
        const body = await res.json();
        if (body.data) setChangelog(body.data);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (showChangelog && changelog.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadChangelog();
    }
  }, [showChangelog, changelog.length, loadChangelog]);

  // Export
  const handleExport = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings/export");
      if (!res.ok) return;
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tseda-settings-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent
    }
  }, []);

  // Import
  const handleImport = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await fetch("/api/admin/settings/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: data.settings ?? data }),
        });
        await refresh();
      } catch {
        // silent
      }
    };
    input.click();
  }, [refresh]);

  const isSearching = search.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Top actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("adminSettings.searchPlaceholder")}
            aria-label={t("adminSettings.searchAriaLabel")}
            className="h-9 w-full rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-input-bg)] pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-text-primary)]/10"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] shadow-sm transition-all hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            <Download className="size-3.5" />
            {t("adminSettings.export")}
          </button>
          <button
            onClick={handleImport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] shadow-sm transition-all hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            <Upload className="size-3.5" />
            {t("adminSettings.import")}
          </button>
          <button
            onClick={() => setResetAllOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-status-error-border)] bg-[var(--color-glass-bg)] backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-[var(--color-status-error)] shadow-sm transition-all hover:bg-[var(--color-status-error-bg)]"
          >
            <RotateCcw className="size-3.5" />
            {t("adminSettings.resetAll")}
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <nav aria-label={t("adminSettings.categoriesNavAriaLabel")} className="hidden lg:block">
          <div className="sticky top-24 space-y-1 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-sm p-2 shadow-sm">
            {CATEGORY_ORDER.map((cat) => {
              const Icon = CATEGORY_ICONS[cat];
              const meta = CATEGORY_META[cat];
              const count = counts[cat] ?? 0;
              const isActive = activeCategory === cat && !isSearching;

              return (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); setSearch(""); }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-text)] shadow-sm"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-dropdown-hover)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1 text-left truncate">{meta.label}</span>
                  {count > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      isActive
                        ? "bg-[var(--color-border-strong)] text-[var(--color-button-primary-text)]"
                        : "bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning)]"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Mobile tab bar */}
        <div className="flex gap-1 overflow-x-auto pb-2 lg:hidden -mx-4 px-4">
          {CATEGORY_ORDER.map((cat) => {
            const Icon = CATEGORY_ICONS[cat];
            const meta = CATEGORY_META[cat];
            const isActive = activeCategory === cat && !isSearching;

            return (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setSearch(""); }}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-text)]"
                    : "bg-[var(--color-dropdown-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-dropdown-hover)]"
                }`}
              >
                <Icon className="size-3.5" />
                {meta.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="space-y-6 min-w-0">
          {/* Category header */}
          {!isSearching && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
                {CATEGORY_META[activeCategory].label}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {CATEGORY_META[activeCategory].description}
              </p>
            </div>
          )}

          {isSearching && (
            <div className="text-sm text-[var(--color-text-secondary)]">
              {filteredSettings.length} {filteredSettings.length === 1 ? t("adminSettings.result") : t("adminSettings.results")} for &quot;{search}&quot;
            </div>
          )}

          {/* Settings by group */}
          {Array.from(grouped.entries()).map(([group, items]) => (
            <div key={group} className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{group}</h3>
                <div className="h-px flex-1 bg-[var(--color-glass-border)]" />
              </div>
              {items.map((s) => (
                <SettingRow
                  key={s.definition.key}
                  setting={s}
                  onSave={handleSave}
                  onReset={handleReset}
                />
              ))}
            </div>
          ))}

          {filteredSettings.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-sm py-16 text-center">
              <Search className="size-8 text-[var(--color-text-muted)] mb-3" />
              <div className="text-sm font-medium text-[var(--color-text-secondary)]">{t("adminSettings.noSettingsFound")}</div>
              <div className="mt-1 text-xs text-[var(--color-text-secondary)]">{t("adminSettings.tryDifferentSearch")}</div>
            </div>
          )}

          {/* Changelog */}
          <div className="border-t border-[var(--color-glass-border)] pt-6">
            <button
              onClick={() => { setShowChangelog(!showChangelog); }}
              className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <ChevronRight className={`size-4 transition-transform duration-200 ${showChangelog ? "rotate-90" : ""}`} />
              {t("adminSettings.recentChanges")}
            </button>

            {showChangelog && (
              <div className="mt-4 space-y-2 animate-fade-in">
                {changelog.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-secondary)]">{t("adminSettings.noChanges")}</p>
                ) : (
                  changelog.slice(0, 15).map((entry, i) => (
                    <div
                      key={`${entry.key}-${entry.changedAt}-${i}`}
                      className="flex items-start gap-3 rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-sm p-3 text-xs"
                    >
                      <Clock className="mt-0.5 size-3.5 shrink-0 text-[var(--color-text-secondary)]" />
                      <div className="min-w-0 flex-1">
                        <div className="text-[var(--color-text-primary)]">
                          <span className="font-medium">{entry.key}</span>
                          {" "}{t("adminSettings.changedBy")}{" "}
                          <span className="font-medium">{emailName(entry.changedBy)}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[var(--color-text-secondary)]">
                          <span className="line-through">{JSON.stringify(entry.oldValue)}</span>
                          <span className="text-[var(--color-text-muted)]">&rarr;</span>
                          <span className="text-[var(--color-text-secondary)] font-medium">{JSON.stringify(entry.newValue)}</span>
                        </div>
                        <div className="mt-0.5 text-[var(--color-text-secondary)]">{formatRelative(entry.changedAt)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reset All Confirm */}
      <ConfirmDialog
        open={resetAllOpen}
        title={t("adminSettings.resetAllConfirmTitle")}
        description={t("adminSettings.resetAllConfirmDesc")}
        confirmLabel={t("adminSettings.resetEverythingBtn")}
        variant="destructive"
        onConfirm={handleResetAll}
        onCancel={() => setResetAllOpen(false)}
      />
    </div>
  );
}
