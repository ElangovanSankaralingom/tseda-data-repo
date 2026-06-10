"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Clock } from "lucide-react";
import SelectDropdown from "@/components/controls/SelectDropdown";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { TranslationKey } from "@/lib/i18n";
import type { SelectOption, SettingWithMeta, SaveStatus } from "./SettingsTypes";

// ---------------------------------------------------------------------------
// Helpers (internal to controls)
// ---------------------------------------------------------------------------

function formatRelative(ts: string, t: (key: TranslationKey) => string): string {
  const diff = Date.now() - Date.parse(ts);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t("adminSettings.justNowShort");
  if (mins < 60) return t("adminSettings.minutesAgo").replace("{n}", String(mins));
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("adminSettings.hoursAgo").replace("{n}", String(hours));
  const days = Math.floor(hours / 24);
  return t("adminSettings.daysAgo").replace("{n}", String(days));
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
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text-primary)]/20 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked
          ? dangerous
            ? "bg-[var(--color-status-error-bg)]"
            : "bg-[var(--color-button-primary-bg)]"
          : "bg-[var(--color-dropdown-hover)]"
      }`}
    >
      <span
        className={`pointer-events-none inline-block size-5 rounded-full bg-[var(--color-text-primary)] shadow-lg ring-0 transition-transform duration-200 ${
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
  const { t } = useTranslation();
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
      setError(t("common.error"));
      return;
    }
    if (min !== undefined && num < min) {
      setError(t("adminSettings.minHint").replace("{n}", String(min)));
      return;
    }
    if (max !== undefined && num > max) {
      setError(t("adminSettings.maxHint").replace("{n}", String(max)));
      return;
    }
    setError("");
    onChange(num);
  }, [local, min, max, onChange, t]);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={disabled || (min !== undefined && value <= min)}
          onClick={() => onChange(Math.max(min ?? -Infinity, value - 1))}
          aria-label={t("adminSettings.decreaseValueAriaLabel")}
          className="flex size-8 items-center justify-center rounded-lg border border-[var(--color-glass-border)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-dropdown-hover)] disabled:opacity-40"
        >
          -
        </button>
        <input
          type="text"
          inputMode="numeric"
          aria-label={t("adminSettings.numericValueAriaLabel")}
          value={local}
          disabled={disabled}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          className={`h-8 w-16 rounded-lg border px-2 text-center text-sm outline-none transition-colors ${
            error ? "border-[var(--color-status-error)] text-[var(--color-status-error)]" : "border-[var(--color-glass-border)] focus:border-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-text-primary)]/10"
          }`}
        />
        <button
          type="button"
          disabled={disabled || (max !== undefined && value >= max)}
          onClick={() => onChange(Math.min(max ?? Infinity, value + 1))}
          aria-label={t("adminSettings.increaseValueAriaLabel")}
          className="flex size-8 items-center justify-center rounded-lg border border-[var(--color-glass-border)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-dropdown-hover)] disabled:opacity-40"
        >
          +
        </button>
      </div>
      {(error || (min !== undefined && max !== undefined)) && (
        <div className={`text-xs ${error ? "text-[var(--color-status-error)]" : "text-[var(--color-text-secondary)]"}`}>
          {error || t("adminSettings.rangeHint").replace("{min}", String(min)).replace("{max}", String(max))}
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
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
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
      aria-label={ariaLabel}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      className="h-9 w-full rounded-lg border border-[var(--color-glass-border)] px-3 text-sm outline-none transition-colors placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-text-primary)]/10 disabled:bg-[var(--color-dropdown-hover)]"
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
  const { t } = useTranslation();
  return (
    <SelectDropdown
      value={value}
      disabled={disabled}
      onChange={onChange}
      options={options}
      placeholder={t("adminSettings.selectValuePlaceholder")}
    />
  );
}

// ---------------------------------------------------------------------------
// Setting Row
// ---------------------------------------------------------------------------

export const SettingRow = memo(function SettingRow({
  setting,
  onSave,
  onReset,
}: {
  setting: SettingWithMeta;
  onSave: (key: string, value: unknown, confirmed?: boolean) => Promise<boolean>;
  onReset: (key: string) => Promise<void>;
}) {
  const { t } = useTranslation();
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
          def.dangerous ? "border-l-4 border-l-[var(--color-status-error)] border-[var(--color-glass-border)]" : "border-[var(--color-glass-border)]"
        } ${
          status === "saved"
            ? "bg-[var(--color-status-success-bg)]"
            : status === "error"
            ? "bg-[var(--color-status-error-bg)]"
            : "bg-[var(--color-glass-bg)] hover:border-[var(--color-text-muted)]"
        }`}
      >
        <div className={`flex ${isInline ? "items-center justify-between gap-4" : "flex-col gap-3"}`}>
          {/* Label + description */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {!isDefault && (
                <span className="size-1.5 rounded-full bg-[var(--color-status-warning)] animate-subtle-pulse" title={t("adminSettings.changedFromDefaultTitle")} />
              )}
              <span className="text-sm font-medium text-[var(--color-text-primary)]">{def.label}</span>
              {def.requiresRestart && (
                <span className="rounded bg-[var(--color-status-info-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-status-info)]">
                  {t("adminSettings.restartRequired")}
                </span>
              )}
              {status === "saved" && (
                <Check className="size-3.5 text-[var(--color-status-success)] animate-fade-in" />
              )}
            </div>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{def.description}</p>
            {def.dangerous && (
              <p className="mt-1 text-xs text-[var(--color-status-error)] flex items-center gap-1">
                <AlertTriangle className="size-3" />
                {t("adminSettings.sensitiveSettingNote")}
              </p>
            )}
            {!isDefault && (
              <button
                onClick={handleReset}
                className="mt-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors opacity-0 group-hover:opacity-100"
              >
                {t("adminSettings.resetToDefault")} ({JSON.stringify(def.default)})
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
                aria-label={def.label}
              />
            )}
            {def.type === "color" && (
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label={t("adminSettings.colorPickerAriaLabel")}
                  value={value as string}
                  onChange={(e) => handleSave(e.target.value)}
                  className="size-8 cursor-pointer rounded border border-[var(--color-glass-border)]"
                />
                <span className="font-mono text-xs text-[var(--color-text-secondary)]">{value as string}</span>
              </div>
            )}
          </div>
        </div>

        {/* Meta */}
        {setting.lastChangedBy && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)]">
            <Clock className="size-3" />
            {t("adminSettings.changedBy")} {emailName(setting.lastChangedBy)}
            {setting.lastChangedAt && ` — ${formatRelative(setting.lastChangedAt, t)}`}
          </div>
        )}
      </div>

      {confirmOpen && (
        <ConfirmDialog
          open
          title={t("adminSettings.changeSensitiveSettingTitle")}
          description={t("adminSettings.changeSensitiveSettingDesc").replace("{label}", def.label)}
          confirmLabel={t("adminSettings.changeSensitiveSettingConfirm")}
          variant="destructive"
          onConfirm={handleConfirm}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </>
  );
});
