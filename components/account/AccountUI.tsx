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
    <div className="rounded-2xl border border-border bg-white/70 p-5">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
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
        <label htmlFor={fieldId} className="text-sm font-medium">{label}</label>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {isValidElement(children)
        ? cloneElement(children, { id: fieldId } as Record<string, unknown>)
        : children}
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
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
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden border border-border">
      <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
    </div>
  );
}
