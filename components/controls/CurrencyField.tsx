"use client";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

// Use CurrencyField for all future monetary inputs.
export default function CurrencyField({
  value = "",
  onChange,
  disabled,
  error,
  placeholder,
  id,
}: { value?: string; onChange?: (value: string) => void; disabled?: boolean; error?: boolean; placeholder?: string; id?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-[var(--color-primary)]">
        ₹
      </span>
      <input
        id={id}
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value.replace(/\D/g, ""))}
        placeholder={placeholder}
        className={cx(
          "w-full rounded-lg border bg-[var(--color-input-bg)] pl-8 pr-3 py-2 text-sm text-[var(--color-text-primary)] shadow-sm transition-all duration-200 outline-none focus-visible:ring-2 placeholder:text-[var(--color-text-muted)]",
          error
            ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
            : "border-[var(--color-input-border)] hover:border-[var(--color-text-muted)] focus-visible:border-[var(--color-primary)] focus-visible:ring-[var(--color-primary)]/20",
          disabled && "opacity-60 pointer-events-none cursor-not-allowed"
        )}
      />
    </div>
  );
}
