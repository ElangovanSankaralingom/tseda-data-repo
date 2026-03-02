"use client";

type CurrencyFieldProps = {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  placeholder?: string;
};

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
}: CurrencyFieldProps) {
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
          "w-full rounded-lg border bg-background pl-8 pr-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2",
          error
            ? "border-red-300 focus-visible:border-red-300 focus-visible:ring-red-200/70"
            : "border-border hover:border-ring/50 focus-visible:border-ring focus-visible:ring-ring/20",
          disabled && "opacity-60 pointer-events-none cursor-not-allowed"
        )}
      />
    </div>
  );
}
