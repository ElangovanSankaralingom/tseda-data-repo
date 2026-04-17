"use client";

import { memo, useCallback } from "react";
import { type SelectDropdownOption } from "@/lib/types/ui";
import { useTranslation } from "@/lib/i18n/useTranslation";

export type { SelectDropdownOption };

type PillSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectDropdownOption[];
  disabled?: boolean;
  error?: boolean;
  /** Optional accent color hex for the selected pill glow */
  accent?: string;
};

/**
 * PillSelect — Inline selectable pill chips for small option sets (2–6 options).
 * Replaces dropdown for fields like semesterType, level, mode, sponsored.
 * Zero overflow issues — everything is inline, no popup.
 */
function PillSelectInner({
  value,
  onChange,
  options,
  disabled,
  error,
  accent,
}: PillSelectProps) {
  const { valueLabel } = useTranslation();

  const resolveLabel = useCallback(
    (option: SelectDropdownOption): string => {
      const translated = valueLabel(option.value);
      return translated !== option.value ? translated : option.label;
    },
    [valueLabel]
  );

  return (
    <div
      className="flex flex-wrap gap-2"
      role="radiogroup"
      aria-invalid={error || undefined}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        const isDisabledOption = disabled || option.disabled;
        const accentColor = accent || "var(--color-primary)";

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={isDisabledOption}
            onClick={() => {
              if (!isDisabledOption) onChange(option.value);
            }}
            className="group relative inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30"
            style={
              isSelected
                ? {
                    background: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
                    border: `1.5px solid color-mix(in srgb, ${accentColor} 45%, transparent)`,
                    color: accentColor,
                    boxShadow: `0 0 12px color-mix(in srgb, ${accentColor} 15%, transparent)`,
                  }
                : {
                    background: "var(--color-surface-inset)",
                    border: "1.5px solid var(--color-border-subtle)",
                    color: "var(--color-text-secondary)",
                  }
            }
          >
            {/* Selected indicator dot */}
            <span
              className="inline-block size-2 rounded-full transition-all duration-200"
              style={
                isSelected
                  ? {
                      background: accentColor,
                      boxShadow: `0 0 6px ${accentColor}`,
                    }
                  : {
                      background: "var(--color-border-default)",
                    }
              }
            />

            {/* Icon if provided */}
            {option.icon ? (
              <span className="inline-flex size-3.5 shrink-0 transition-colors">
                <option.icon className="size-3.5" />
              </span>
            ) : null}

            {/* Label */}
            <span className="whitespace-nowrap">{resolveLabel(option)}</span>

            {/* Error ring */}
            {error && !isSelected ? (
              <span
                className="pointer-events-none absolute inset-0 rounded-xl"
                style={{ border: "1.5px solid rgba(239,68,68,0.4)" }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

const PillSelect = memo(PillSelectInner);
export default PillSelect;
