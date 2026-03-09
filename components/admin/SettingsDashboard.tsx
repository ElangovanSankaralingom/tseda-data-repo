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

const CATEGORY_META: Record<SettingCategory, { label: string; description: string }> = {
  general: { label: "General", description: "The basics — name, branding, and identity" },
  auth: { label: "Authentication", description: "Who gets in and who doesn't" },
  entries: { label: "Entries & Edit Windows", description: "Control the flow of data entry" },
  streaks: { label: "Streaks", description: "Tweak the gamification engine" },
  maintenance: { label: "Maintenance", description: "Keep the engine room running smooth" },
  appearance: { label: "Appearance", description: "Make it look the way you want" },
  advanced: { label: "Advanced", description: "Here be dragons. Change with caution." },
};

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
  const [settings, setSettings] = useState(initialSettings);
  const [counts, setCounts] = useState(initialCounts);
  const [activeCategory, setActiveCategory] = useState<SettingCategory>("general");
  const [search, setSearch] = useState("");
  const [changelog, setChangelog] = useState<ChangeLogEntry[]>([]);
  const [showChangelog, setShowChangelog] = useState(false);
  const [resetAllOpen, setResetAllOpen] = useState(false);

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
      const group = s.definition.group ?? "Other";
      const list = groups.get(group) ?? [];
      list.push(s);
      groups.set(group, list);
    }
    return groups;
  }, [filteredSettings]);

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
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search settings..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:text-slate-900"
          >
            <Download className="size-3.5" />
            Export
          </button>
          <button
            onClick={handleImport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:text-slate-900"
          >
            <Upload className="size-3.5" />
            Import
          </button>
          <button
            onClick={() => setResetAllOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm transition-all hover:bg-red-50"
          >
            <RotateCcw className="size-3.5" />
            Reset All
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <nav className="hidden lg:block">
          <div className="sticky top-24 space-y-1 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
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
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="flex-1 text-left truncate">{meta.label}</span>
                  {count > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-amber-100 text-amber-700"
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
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
              <h2 className="text-xl font-semibold text-slate-900">
                {CATEGORY_META[activeCategory].label}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {CATEGORY_META[activeCategory].description}
              </p>
            </div>
          )}

          {isSearching && (
            <div className="text-sm text-slate-500">
              {filteredSettings.length} {filteredSettings.length === 1 ? "result" : "results"} for &quot;{search}&quot;
            </div>
          )}

          {/* Settings by group */}
          {Array.from(grouped.entries()).map(([group, items]) => (
            <div key={group} className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-700">{group}</h3>
                <div className="h-px flex-1 bg-slate-100" />
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
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
              <Search className="size-8 text-slate-300 mb-3" />
              <div className="text-sm font-medium text-slate-500">No settings found</div>
              <div className="mt-1 text-xs text-slate-400">Try a different search term</div>
            </div>
          )}

          {/* Changelog */}
          <div className="border-t border-slate-200 pt-6">
            <button
              onClick={() => { setShowChangelog(!showChangelog); }}
              className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors"
            >
              <ChevronRight className={`size-4 transition-transform duration-200 ${showChangelog ? "rotate-90" : ""}`} />
              Recent Changes
            </button>

            {showChangelog && (
              <div className="mt-4 space-y-2 animate-fade-in">
                {changelog.length === 0 ? (
                  <p className="text-sm text-slate-400">No changes yet</p>
                ) : (
                  changelog.slice(0, 15).map((entry, i) => (
                    <div
                      key={`${entry.key}-${entry.changedAt}-${i}`}
                      className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-xs"
                    >
                      <Clock className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <div className="text-slate-700">
                          <span className="font-medium">{entry.key}</span>
                          {" changed by "}
                          <span className="font-medium">{emailName(entry.changedBy)}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-slate-400">
                          <span className="line-through">{JSON.stringify(entry.oldValue)}</span>
                          <span className="text-slate-300">&rarr;</span>
                          <span className="text-slate-600 font-medium">{JSON.stringify(entry.newValue)}</span>
                        </div>
                        <div className="mt-0.5 text-slate-400">{formatRelative(entry.changedAt)}</div>
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
        title="Reset all settings?"
        description="This will reset every setting to its default value. This action cannot be undone."
        confirmLabel="Reset Everything"
        variant="destructive"
        onConfirm={handleResetAll}
        onCancel={() => setResetAllOpen(false)}
      />
    </div>
  );
}
