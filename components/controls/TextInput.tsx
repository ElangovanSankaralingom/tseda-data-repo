"use client";

import { cn } from "@/lib/utils";

type TextInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  error?: boolean;
};

export default function TextInput({ error, className, disabled, ...props }: TextInputProps) {
  return (
    <input
      type="text"
      className={cn(
        "w-full rounded-lg border bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] shadow-sm transition-all duration-200 outline-none focus-visible:ring-2",
        error
          ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
          : "border-[var(--color-input-border)] hover:border-[var(--color-text-muted)] focus-visible:border-[var(--color-primary)] focus-visible:ring-[var(--color-primary)]/20",
        disabled && "pointer-events-none cursor-not-allowed opacity-60",
        "placeholder:text-[var(--color-text-muted)]",
        className
      )}
      disabled={disabled}
      {...props}
    />
  );
}
