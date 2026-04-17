"use client";

import DateField from "@/components/controls/DateField";
import SelectDropdown from "@/components/controls/SelectDropdown";
import Field from "@/components/data-entry/Field";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { SchemaFieldDefinition } from "@/data/schemas/types";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type FieldRendererProps = {
  field: SchemaFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  error?: string;
  submitted?: boolean;
  hint?: string;
};

/**
 * Schema-driven field renderer.
 *
 * Renders a form field based on the schema field definition's `kind` and properties.
 * Handles: string (text), string with enumValues (select), date, number.
 *
 * For complex fields (file uploads, faculty pickers, currency inputs),
 * use custom field renderers via the `fieldOverrides` prop on BaseEntryAdapter.
 */
export default function FieldRenderer({
  field,
  value,
  onChange,
  disabled = false,
  error,
  submitted = false,
  hint,
}: FieldRendererProps) {
  const { fieldLabel: resolveFieldLabel } = useTranslation();
  const showError = submitted && !!error;
  const isRequired = field.required !== false;
  const translatedLabel = resolveFieldLabel(field.key);
  const label = translatedLabel !== field.key ? translatedLabel : field.label;

  // Skip non-renderable fields
  if (field.key === "id" || field.key === "pdfMeta" || field.key === "streak") {
    return null;
  }

  // Upload fields are not rendered by FieldRenderer — use custom renderers
  if (field.upload) {
    return null;
  }

  // Select dropdown for enum fields
  if (field.enumValues && field.enumValues.length > 0) {
    return (
      <Field label={label} error={showError ? error : undefined} hint={hint} required={isRequired}>
        {(a11yProps: { id: string; "aria-describedby"?: string; "aria-required"?: boolean; "aria-invalid"?: boolean }) => (
          <SelectDropdown
            id={a11yProps.id}
            value={String(value ?? "")}
            onChange={(v) => onChange(v)}
            options={field.enumValues!.map((v) => ({ label: String(v), value: String(v) }))}
            placeholder={`Select ${label.toLowerCase()}`}
            disabled={disabled}
            error={showError}
          />
        )}
      </Field>
    );
  }

  // Date field
  if (field.kind === "date") {
    return (
      <Field label={label} error={showError ? error : undefined} hint={hint} required={isRequired}>
        <DateField
          value={String(value ?? "")}
          onChange={(v) => onChange(v)}
          disabled={disabled}
          error={showError}
        />
      </Field>
    );
  }

  // Number field
  if (field.kind === "number") {
    return (
      <Field label={label} error={showError ? error : undefined} hint={hint} required={isRequired}>
        {(a11yProps: { id: string; "aria-describedby"?: string; "aria-required"?: boolean; "aria-invalid"?: boolean }) => (
          <input
            id={a11yProps.id}
            type="number"
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(e) => {
              const raw = e.target.value;
              onChange(raw === "" ? null : Number(raw));
            }}
            min={field.min}
            max={field.max}
            disabled={disabled}
            aria-describedby={a11yProps["aria-describedby"]}
            aria-required={a11yProps["aria-required"]}
            aria-invalid={a11yProps["aria-invalid"]}
            aria-disabled={disabled || undefined}
            className={cx(
              "w-full rounded-lg border bg-[var(--color-input-bg)] px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 placeholder:text-[var(--color-text-secondary)]",
              showError
                ? "border-[var(--color-status-error)] focus-visible:border-[var(--color-status-error)] focus-visible:ring-[var(--color-status-error-border)]"
                : "border-[var(--color-input-border)] hover:border-[var(--color-text-muted)] focus-visible:border-[var(--color-input-focus-ring)] focus-visible:ring-[var(--color-input-focus-ring)]/20",
              disabled && "cursor-not-allowed opacity-60",
            )}
          />
        )}
      </Field>
    );
  }

  // Default: text input for string and unknown kinds
  if (field.kind === "string" || field.kind === "unknown") {
    return (
      <Field label={label} error={showError ? error : undefined} hint={hint} required={isRequired}>
        {(a11yProps: { id: string; "aria-describedby"?: string; "aria-required"?: boolean; "aria-invalid"?: boolean }) => (
          <input
            id={a11yProps.id}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            maxLength={field.maxLength}
            aria-describedby={a11yProps["aria-describedby"]}
            aria-required={a11yProps["aria-required"]}
            aria-invalid={a11yProps["aria-invalid"]}
            aria-disabled={disabled || undefined}
            className={cx(
              "w-full rounded-lg border bg-[var(--color-input-bg)] px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 placeholder:text-[var(--color-text-secondary)]",
              showError
                ? "border-[var(--color-status-error)] focus-visible:border-[var(--color-status-error)] focus-visible:ring-[var(--color-status-error-border)]"
                : "border-[var(--color-input-border)] hover:border-[var(--color-text-muted)] focus-visible:border-[var(--color-input-focus-ring)] focus-visible:ring-[var(--color-input-focus-ring)]/20",
              disabled && "cursor-not-allowed opacity-60",
            )}
          />
        )}
      </Field>
    );
  }

  // Arrays, objects without upload — skip (handled by custom renderers)
  return null;
}
