"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Clock } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { SelectOption, SettingWithMeta, SaveStatus } from "./SettingsTypes";

// ---------------------------------------------------------------------------
// Helpers (internal to controls)
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

export function Toggle({
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

export function NumberInput({
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
        <div className={`text-xs ${error ? "text-red-500" : "text-slate-500"}`}>
          {error || `Range: ${min} – ${max}`}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// String Input
// ---------------------------------------------------------------------------

export function StringInput({
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
      className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none transition-colors placeholder:text-slate-500 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-50"
    />
  );
}

// ---------------------------------------------------------------------------
// Select Input
// ---------------------------------------------------------------------------

export function SelectInput({
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
      aria-label="Select value"
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

export function SettingRow({
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
                className="mt-1 text-xs text-slate-500 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100"
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
          <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
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
