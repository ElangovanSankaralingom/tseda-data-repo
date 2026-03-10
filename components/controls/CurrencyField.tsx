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
}: { value?: string; onChange?: (value: string) => void; disabled?: boolean; error?: boolean; placeholder?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
        ₹
      </span>
      <input
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value.replace(/\D/g, ""))}
        placeholder={placeholder}
        className={cx(
          "w-full rounded-lg border bg-white pl-8 pr-3 py-2 text-sm shadow-sm transition-colors outline-none focus-visible:ring-2 placeholder:text-slate-500",
          error
            ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
            : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
          disabled && "opacity-60 pointer-events-none cursor-not-allowed"
        )}
      />
    </div>
  );
}
