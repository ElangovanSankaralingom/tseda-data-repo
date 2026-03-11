"use client";

import type { ReactNode } from "react";

export default function SelectField({
  value,
  onChange,
  disabled,
  error,
  children,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  error?: boolean;
  children: ReactNode;
  "aria-label"?: string;
}) {
  return (
    <select
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm transition-colors outline-none ${
        error
          ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-2 focus-visible:ring-red-500/20"
          : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-2 focus-visible:ring-[#1E3A5F]/20"
      }${disabled ? " cursor-not-allowed opacity-60" : ""}`}
    >
      {children}
    </select>
  );
}
