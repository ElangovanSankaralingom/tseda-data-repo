"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  AlertTriangle,
  Clock,
  Check,
  X,
  Info,
} from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SettingType = "string" | "number" | "boolean" | "select" | "multi-select" | "email" | "email-list" | "color";
type SettingCategory = "general" | "auth" | "entries" | "streaks" | "maintenance" | "appearance" | "advanced";

type SelectOption = { value: string; label: string };
type SettingValidation = {
  min?: number;
  max?: number;
  pattern?: string;
  options?: SelectOption[];
  required?: boolean;
};

type SettingDefinition = {
  key: string;
  label: string;
  description: string;
  category: SettingCategory;
  type: SettingType;
  default: unknown;
  validation?: SettingValidation;
  requiresRestart?: boolean;
  dangerous?: boolean;
  group?: string;
};

type SettingWithMeta = {
  value: unknown;
  definition: SettingDefinition;
  isDefault: boolean;
  lastChangedBy?: string;
  lastChangedAt?: string;
};

type ChangeLogEntry = {
  key: string;
  oldValue: unknown;
  newValue: unknown;
  changedBy: string;
  changedAt: string;
};

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
// Toggle Switch
// ---------------------------------------------------------------------------

function Toggle({
  checked,
  onChange,
  dangerous,
  disabled,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  dangerous?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked
          ? dangerous
            ? "bg-red-500"
            : "bg-slate-900"
          : "bg-slate-200"
      }`}
    >
      <span
        className={`pointer-events-none inline-block size-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Number Stepper
// ---------------------------------------------------------------------------

function NumberInput({
  value,
  onChange,
  min,
  max,
  disabled,
}: {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const [local, setLocal] = useState(String(value));
  const [error, setError] = useState("");

  useEffect(() => {
    setLocal(String(value));
    setError("");
  }, [value]);

  const commit = useCallback(() => {
    const num = Number(local);
    if (Number.isNaN(num)) {
      setError("Must be a number");
      return;
    }
    if (min !== undefined && num < min) {
      setError(`Min: ${min}`);
      return;
    }
    if (max !== undefined && num > max) {
      setError(`Max: ${max}`);
      return;
    }
    setError("");
    onChange(num);
  }, [local, min, max, onChange]);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={disabled || (min !== undefined && value <= min)}
          onClick={() => onChange(Math.max(min ?? -Infinity, value - 1))}
          className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40"
        >
          -
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={local}
          disabled={disabled}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          className={`h-8 w-16 rounded-lg border px-2 text-center text-sm outline-none transition-colors ${
            error ? "border-red-400 text-red-600" : "border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
          }`}
        />
        <button
          type="button"
          disabled={disabled || (max !== undefined && value >= max)}
          onClick={() => onChange(Math.min(max ?? Infinity, value + 1))}
          className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40"
        >
          +
        </button>
      </div>
      {(error || (min !== undefined && max !== undefined)) && (
        <div className={`text-xs ${error ? "text-red-500" : "text-slate-400"}`}>
          {error || `Range: ${min} – ${max}`}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// String Input
// ---------------------------------------------------------------------------

function StringInput({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const commit = useCallback(() => {
    if (local !== value) onChange(local);
  }, [local, value, onChange]);

  return (
    <input
      type="text"
      value={local}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-50"
    />
  );
}

// ---------------------------------------------------------------------------
// Select Input
// ---------------------------------------------------------------------------

function SelectInput({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: SelectOption[];
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="select-styled h-9 rounded-lg border border-slate-200 bg-white px-3 pr-8 text-sm outline-none transition-colors hover:border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-50"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Setting Row
// ---------------------------------------------------------------------------

type SaveStatus = "idle" | "saving" | "saved" | "error";

function SettingRow({
  setting,
  onSave,
  onReset,
}: {
  setting: SettingWithMeta;
  onSave: (key: string, value: unknown, confirmed?: boolean) => Promise<boolean>;
  onReset: (key: string) => Promise<void>;
}) {
  const { definition: def, value, isDefault } = setting;
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingValue, setPendingValue] = useState<unknown>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flashStatus = useCallback((s: SaveStatus) => {
    setStatus(s);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setStatus("idle"), 1500);
  }, []);

  const handleSave = useCallback(async (newValue: unknown, confirmed = false) => {
    if (def.dangerous && !confirmed) {
      setPendingValue(newValue);
      setConfirmOpen(true);
      return;
    }
    setStatus("saving");
    const ok = await onSave(def.key, newValue, confirmed);
    flashStatus(ok ? "saved" : "error");
  }, [def, onSave, flashStatus]);

  const handleConfirm = useCallback(async () => {
    setConfirmOpen(false);
    await handleSave(pendingValue, true);
  }, [pendingValue, handleSave]);

  const handleReset = useCallback(async () => {
    setStatus("saving");
    await onReset(def.key);
    flashStatus("saved");
  }, [def.key, onReset, flashStatus]);

  const isInline = def.type === "boolean" || def.type === "select" || def.type === "number";

  return (
    <>
      <div
        className={`group relative rounded-xl border p-4 transition-all duration-300 ${
          def.dangerous ? "border-l-4 border-l-red-400 border-slate-200" : "border-slate-200"
        } ${
          status === "saved"
            ? "bg-emerald-50/60"
            : status === "error"
            ? "bg-red-50/60"
            : "bg-white hover:border-slate-300"
        }`}
      >
        <div className={`flex ${isInline ? "items-center justify-between gap-4" : "flex-col gap-3"}`}>
          {/* Label + description */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {!isDefault && (
                <span className="size-1.5 rounded-full bg-amber-400 animate-subtle-pulse" title="Changed from default" />
              )}
              <span className="text-sm font-medium text-slate-900">{def.label}</span>
              {def.requiresRestart && (
                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                  Restart required
                </span>
              )}
              {status === "saved" && (
                <Check className="size-3.5 text-emerald-500 animate-fade-in" />
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">{def.description}</p>
            {def.dangerous && (
              <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                <AlertTriangle className="size-3" />
                Sensitive setting — changes take effect immediately
              </p>
            )}
            {!isDefault && (
              <button
                onClick={handleReset}
                className="mt-1 text-xs text-slate-400 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100"
              >
                Reset to default ({JSON.stringify(def.default)})
              </button>
            )}
          </div>

          {/* Control */}
          <div className="shrink-0">
            {def.type === "boolean" && (
              <Toggle
                checked={value as boolean}
                onChange={(v) => handleSave(v)}
                dangerous={def.dangerous}
              />
            )}
            {def.type === "number" && (
              <NumberInput
                value={value as number}
                onChange={(v) => handleSave(v)}
                min={def.validation?.min}
                max={def.validation?.max}
              />
            )}
            {def.type === "select" && (
              <SelectInput
                value={value as string}
                options={def.validation?.options ?? []}
                onChange={(v) => handleSave(v)}
              />
            )}
            {(def.type === "string" || def.type === "email") && (
              <StringInput
                value={value as string}
                onChange={(v) => handleSave(v)}
              />
            )}
            {def.type === "color" && (
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={value as string}
                  onChange={(e) => handleSave(e.target.value)}
                  className="size-8 cursor-pointer rounded border border-slate-200"
                />
                <span className="font-mono text-xs text-slate-500">{value as string}</span>
              </div>
            )}
          </div>
        </div>

        {/* Meta */}
        {setting.lastChangedBy && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
            <Clock className="size-3" />
            Changed by {emailName(setting.lastChangedBy)}
            {setting.lastChangedAt && ` — ${formatRelative(setting.lastChangedAt)}`}
          </div>
        )}
      </div>

      {confirmOpen && (
        <ConfirmDialog
          open
          title="Change sensitive setting?"
          description={`You're about to change "${def.label}". This is a sensitive setting that takes effect immediately.`}
          confirmLabel="Yes, change it"
          variant="destructive"
          onConfirm={handleConfirm}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </>
  );
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
              {filteredSettings.length} {filteredSettings.length === 1 ? "result" : "results"} for "{search}"
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
