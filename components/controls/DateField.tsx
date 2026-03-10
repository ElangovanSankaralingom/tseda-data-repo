"use client";

import { useRef } from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function DateField({ value, onChange, disabled, error }: { value: string | null | undefined; onChange: (next: string) => void; disabled?: boolean; error?: boolean }) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  function openPicker() {
    const input = inputRef.current;
    if (!input || disabled) return;

    try {
      input.showPicker?.();
    } catch {}

    input.focus();
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="date"
        value={value || ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cx(
          "date-modern w-full rounded-lg border bg-white px-3 py-2 pr-12 text-sm shadow-sm transition-colors outline-none focus-visible:ring-2",
          error
            ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
            : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
          disabled && "cursor-not-allowed opacity-60"
        )}
      />

      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        aria-label="Open calendar"
        className={cx(
          "absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors",
          disabled
            ? "pointer-events-none cursor-not-allowed opacity-50"
            : "hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
        )}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-2">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        </svg>
      </button>
    </div>
  );
}
