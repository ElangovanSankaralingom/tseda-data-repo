"use client";

import { type ReactNode, memo } from "react";
import { Check } from "lucide-react";

type FormFieldGroupProps = {
  /** Step number displayed in the indicator */
  step: number;
  /** Group title */
  title: string;
  /** Optional subtitle/hint below the title */
  subtitle?: string;
  /** lucide-react icon component */
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  /** Accent color (CSS color value) for the step indicator and left bar */
  accent: string;
  /** Number of fields filled in this group */
  filled: number;
  /** Total number of fields in this group */
  total: number;
  /** Whether the group's fields are disabled */
  disabled?: boolean;
  /** Whether this group is locked (post-generate, view mode, etc.) */
  locked?: boolean;
  /** Animation delay for staggered entrance */
  animationDelay?: number;
  /** Children: the actual form fields */
  children: ReactNode;
};

/**
 * A semantically grouped field section with step indicator, progress badge,
 * and distinct surface treatment. Creates visual rhythm and progression
 * through the form.
 */
const FormFieldGroup = memo(function FormFieldGroup({
  step,
  title,
  subtitle,
  icon: Icon,
  accent,
  filled,
  total,
  disabled = false,
  locked = false,
  animationDelay = 0,
  children,
}: FormFieldGroupProps) {
  const isComplete = filled >= total && total > 0;
  const hasProgress = total > 0;

  return (
    <div
      className="group/field-group relative animate-fade-in-up"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Main container */}
      <div
        className="relative overflow-hidden rounded-xl border transition-all duration-300"
        style={{
          borderColor: isComplete
            ? `color-mix(in srgb, ${accent} 30%, transparent)`
            : "var(--color-border-default)",
          background: "var(--color-glass-bg)",
        }}
      >
        {/* Left accent bar */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px] transition-all duration-500"
          style={{
            background: isComplete
              ? accent
              : `linear-gradient(180deg, ${accent} 0%, color-mix(in srgb, ${accent} 30%, transparent) 100%)`,
            opacity: isComplete ? 1 : 0.6,
          }}
        />

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-4 pb-3">
          {/* Step indicator */}
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-all duration-300"
            style={{
              background: isComplete
                ? accent
                : `color-mix(in srgb, ${accent} 12%, transparent)`,
              color: isComplete ? "#fff" : accent,
              boxShadow: isComplete ? `0 2px 8px color-mix(in srgb, ${accent} 30%, transparent)` : "none",
            }}
          >
            {isComplete ? <Check className="size-4" strokeWidth={3} /> : step}
          </div>

          {/* Title + subtitle */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Icon
                className="size-4 shrink-0"
                style={{ color: accent }}
              />
              <h3
                className="text-sm font-semibold tracking-tight"
                style={{ color: "var(--color-text-primary)" }}
              >
                {title}
              </h3>
            </div>
            {subtitle ? (
              <p
                className="mt-0.5 text-xs"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {subtitle}
              </p>
            ) : null}
          </div>

          {/* Completion badge */}
          {hasProgress ? (
            <div
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums transition-all duration-300"
              style={{
                background: isComplete
                  ? `color-mix(in srgb, ${accent} 12%, transparent)`
                  : "var(--color-surface-raised)",
                color: isComplete ? accent : "var(--color-text-tertiary)",
              }}
            >
              <span>{filled}/{total}</span>
            </div>
          ) : null}
        </div>

        {/* Divider */}
        <div
          className="mx-5 h-px"
          style={{ background: "var(--color-divider)" }}
        />

        {/* Field content */}
        <div
          className="px-5 pt-4 pb-5"
          style={{
            opacity: disabled || locked ? 0.6 : 1,
            pointerEvents: disabled || locked ? "none" : "auto",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
});

export default FormFieldGroup;
