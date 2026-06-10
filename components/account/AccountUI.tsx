"use client";

import { cloneElement, isValidElement, useId } from "react";
import { RoleButton } from "@/components/ui/RoleButton";

export function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-sm p-5">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-[var(--color-text-muted)]">{subtitle}</p> : null}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const autoId = useId();
  const fieldId = `account-field-${autoId}`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={fieldId} className="text-sm font-medium text-[var(--color-text-secondary)]">{label}</label>
        {hint ? <span className="text-xs text-[var(--color-text-muted)]">{hint}</span> : null}
      </div>
      {isValidElement(children)
        ? cloneElement(children, { id: fieldId } as Record<string, unknown>)
        : children}
      {error ? <div className="text-xs text-[var(--color-status-error)]">{error}</div> : null}
    </div>
  );
}

export function MiniButton({
  children,
  onClick,
  variant = "default",
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "danger" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const role =
    variant === "danger"
      ? "destructive"
      : variant === "ghost"
        ? "ghost"
        : "primary";

  return (
    <RoleButton
      role={role}
      type={type}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </RoleButton>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full rounded-full bg-[var(--color-glass-bg)] overflow-hidden border border-[var(--color-glass-border)]">
      <div className="h-full bg-[var(--color-primary)] transition-all duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}
