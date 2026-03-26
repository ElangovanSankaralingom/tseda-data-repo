"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function InlineSearch({
  placeholder = "Search...",
  onSearch,
  onClear,
  className,
  debounceMs = 200,
}: { placeholder?: string; onSearch: (query: string) => void; onClear?: () => void; className?: string; debounceMs?: number }) {
  const [value, setValue] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setValue(next);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onSearch(next.trim());
      }, debounceMs);
    },
    [onSearch, debounceMs],
  );

  const handleClear = useCallback(() => {
    setValue("");
    onSearch("");
    onClear?.();
  }, [onSearch, onClear]);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label="Search"
        className="h-10 w-full rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] pl-9 pr-9 text-sm outline-none transition-colors placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-text-primary)]/10"
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
