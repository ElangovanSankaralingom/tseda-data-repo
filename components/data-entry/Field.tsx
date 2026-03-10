import { cloneElement, isValidElement, useId } from "react";

type FieldProps = {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode | ((props: { id: string; "aria-describedby"?: string; "aria-required"?: boolean; "aria-invalid"?: boolean }) => React.ReactNode);
};

export default function Field({ label, error, hint, required, children }: FieldProps) {
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
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={fieldId} className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}
        </label>
        {hint ? <span id={hintId} className="text-xs text-slate-500">{hint}</span> : null}
      </div>
      {typeof children === "function"
        ? children(childProps)
        : isValidElement(children)
          ? cloneElement(children, { id: fieldId } as Record<string, unknown>)
          : children}
      {error ? <div id={errorId} className="text-xs text-red-600" role="alert">{error}</div> : null}
    </div>
  );
}
