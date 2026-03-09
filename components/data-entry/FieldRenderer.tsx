"use client";

import DateField from "@/components/controls/DateField";
import SelectDropdown from "@/components/controls/SelectDropdown";
import Field from "@/components/data-entry/Field";
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
  const showError = submitted && !!error;

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
    const options = field.enumValues.map((v) => ({
      label: String(v),
      value: String(v),
    }));

    return (
      <Field label={field.label} error={showError ? error : undefined} hint={hint}>
        <SelectDropdown
          value={String(value ?? "")}
          onChange={(v) => onChange(v)}
          options={options}
          placeholder={`Select ${field.label.toLowerCase()}`}
          disabled={disabled}
          error={showError}
        />
      </Field>
    );
  }

  // Date field
  if (field.kind === "date") {
    return (
      <Field label={field.label} error={showError ? error : undefined} hint={hint}>
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
      <Field label={field.label} error={showError ? error : undefined} hint={hint}>
        <input
          type="number"
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) => {
            const raw = e.target.value;
            onChange(raw === "" ? null : Number(raw));
          }}
          min={field.min}
          max={field.max}
          disabled={disabled}
          className={cx(
            "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 placeholder:text-slate-400",
            showError
              ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
              : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
            disabled && "cursor-not-allowed opacity-60",
          )}
        />
      </Field>
    );
  }

  // Default: text input for string and unknown kinds
  if (field.kind === "string" || field.kind === "unknown") {
    return (
      <Field label={field.label} error={showError ? error : undefined} hint={hint}>
        <input
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          maxLength={field.maxLength}
          className={cx(
            "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 placeholder:text-slate-400",
            showError
              ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
              : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
            disabled && "cursor-not-allowed opacity-60",
          )}
        />
      </Field>
    );
  }

  // Arrays, objects without upload — skip (handled by custom renderers)
  return null;
}
