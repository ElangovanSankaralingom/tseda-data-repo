import { cloneElement, isValidElement, useId } from "react";

type FieldProps = {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  /** Schema field key — used for scroll-to-field navigation */
  fieldKey?: string;
  children: React.ReactNode | ((props: { id: string; "aria-describedby"?: string; "aria-required"?: boolean; "aria-invalid"?: boolean }) => React.ReactNode);
};

export default function Field({ label, error, hint, required, fieldKey, children }: FieldProps) {
  const generatedId = useId();
  const fieldId = `field-${generatedId}`;
  const errorId = error ? `${fieldId}-error` : undefined;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  const childProps = {
    id: fieldId,
    "aria-describedby": describedBy,
    "aria-required": required || undefined,
    "aria-invalid": !!error || undefined,
  };

  return (
    <div className="space-y-1.5" data-field-key={fieldKey || undefined}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={fieldId} className="text-sm font-medium text-[var(--color-text-secondary)]">
          {label}
          {required && <span className="ml-0.5 text-[var(--color-primary)]" aria-hidden="true">*</span>}
        </label>
        {hint ? <span id={hintId} className="text-xs text-[var(--color-text-secondary)]">{hint}</span> : null}
      </div>
      {typeof children === "function"
        ? children(childProps)
        : isValidElement(children)
          ? cloneElement(children, { id: fieldId } as Record<string, unknown>)
          : children}
      {error ? <div id={errorId} className="text-xs text-[var(--color-status-error)]" role="alert">{error}</div> : null}
    </div>
  );
}
