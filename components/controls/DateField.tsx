"use client";

import { useRef } from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function DateField({ value, onChange, disabled, error, id }: { value: string | null | undefined; onChange: (next: string) => void; disabled?: boolean; error?: boolean; id?: string }) {
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
        id={id}
        ref={inputRef}
        type="date"
        value={value || ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cx(
          "date-modern w-full rounded-lg border bg-[var(--color-input-bg)] px-3 py-2 pr-12 text-sm text-[var(--color-text-primary)] shadow-sm transition-all duration-200 outline-none focus-visible:ring-2",
          error
            ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
            : "border-[var(--color-input-border)] hover:border-[var(--color-text-muted)] focus-visible:border-[var(--color-primary)] focus-visible:ring-[var(--color-primary)]/20",
          disabled && "cursor-not-allowed opacity-60"
        )}
      />

      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        aria-label="Open calendar"
        className={cx(
          "absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors",
          disabled
            ? "pointer-events-none cursor-not-allowed opacity-50"
            : "hover:bg-[var(--color-glass-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/20"
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
