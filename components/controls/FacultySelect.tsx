"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n/useTranslation";

export type FacultyOption = {
  name: string;
  email: string;
};

export type FacultySelection = {
  name: string;
  email: string;
};

type FacultySelectProps = {
  value: FacultySelection;
  onChange: (next: FacultySelection) => void;
  options?: FacultyOption[];
  fetchEndpoint?: string;
  disabledEmails: Set<string>;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function FacultySelect({
  value,
  onChange,
  options,
  fetchEndpoint,
  disabledEmails,
  placeholder,
  disabled,
  error,
}: FacultySelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [fetchedOptions, setFetchedOptions] = useState<FacultyOption[]>([]);
  const [fetching, setFetching] = useState(false);
  const inputValue = value.name;
  const normalizedQuery = inputValue.trim().toLowerCase();

  // Use fetched results when fetchEndpoint is provided and no static options
  const useApi = !!fetchEndpoint && !options;
  const sourceOptions = useMemo(() => useApi ? fetchedOptions : (options ?? []), [useApi, fetchedOptions, options]);

  const filteredOptions = useMemo(() => {
    if (useApi) return sourceOptions;
    return sourceOptions.filter((option) => {
      if (!normalizedQuery) return true;
      return (
        option.name.toLowerCase().includes(normalizedQuery) ||
        option.email.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [sourceOptions, normalizedQuery, useApi]);

  const firstEnabledIndex = filteredOptions.findIndex(
    (option) => !disabledEmails.has(option.email.toLowerCase())
  );

  // Debounced API search
  useEffect(() => {
    if (!useApi || !open) return;
    if (normalizedQuery.length < 2) {
      setFetchedOptions([]);
      return;
    }
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setFetching(true);
      try {
        const res = await fetch(`${fetchEndpoint}?q=${encodeURIComponent(normalizedQuery)}`);
        const body = await res.json();
        const items = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
        setFetchedOptions(items.map((f: Record<string, unknown>) => ({
          name: String(f.fullName ?? f.name ?? ""),
          email: String(f.email ?? ""),
        })));
      } catch {
        setFetchedOptions([]);
      } finally {
        setFetching(false);
      }
    }, 300);
    return () => clearTimeout(searchTimerRef.current);
  }, [useApi, open, normalizedQuery, fetchEndpoint]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setHighlightedIndex(-1);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    return () => clearTimeout(searchTimerRef.current);
  }, []);

  function chooseOption(option: FacultyOption) {
    if (disabled) return;
    onChange({ name: option.name, email: option.email.toLowerCase() });
    setOpen(false);
    setHighlightedIndex(-1);
  }

  function moveHighlight(step: 1 | -1) {
    if (filteredOptions.length === 0) return;

    let nextIndex = highlightedIndex;
    for (let count = 0; count < filteredOptions.length; count += 1) {
      nextIndex = (nextIndex + step + filteredOptions.length) % filteredOptions.length;
      if (!disabledEmails.has(filteredOptions[nextIndex].email.toLowerCase())) {
        setHighlightedIndex(nextIndex);
        return;
      }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        value={inputValue}
        onFocus={() => {
          if (disabled) return;
          setOpen(true);
          setHighlightedIndex(firstEnabledIndex);
        }}
        onChange={(event) => {
          if (disabled) return;
          onChange({ name: event.target.value, email: "" });
          setOpen(true);
          setHighlightedIndex(firstEnabledIndex);
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (!open) {
              setOpen(true);
              setHighlightedIndex(firstEnabledIndex);
              return;
            }
            moveHighlight(1);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) {
              setOpen(true);
              setHighlightedIndex(firstEnabledIndex);
              return;
            }
            moveHighlight(-1);
          } else if (event.key === "Enter") {
            if (!open || highlightedIndex < 0) return;
            const highlighted = filteredOptions[highlightedIndex];
            if (!highlighted || disabledEmails.has(highlighted.email.toLowerCase())) return;
            event.preventDefault();
            chooseOption(highlighted);
          } else if (event.key === "Escape") {
            setOpen(false);
            setHighlightedIndex(-1);
          }
        }}
        placeholder={placeholder ?? "Search or type staff name"}
        readOnly={disabled}
        className={cx(
          "w-full rounded-lg border bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] shadow-sm transition-all duration-200 outline-none focus-visible:ring-2 placeholder:text-[var(--color-text-muted)]",
          error
            ? "border-[var(--color-status-error)] focus-visible:border-[var(--color-status-error)] focus-visible:ring-[var(--color-status-error-border)]"
            : "border-[var(--color-input-border)] hover:border-[var(--color-text-muted)] focus-visible:border-[var(--color-primary)] focus-visible:ring-[var(--color-primary)]/20",
          disabled && "pointer-events-none cursor-not-allowed opacity-60"
        )}
      />

      {open ? (
        <div className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-dropdown-bg)] backdrop-blur-2xl p-1 shadow-2xl animate-dropdown-in">
          {fetching ? (
            <div className="px-3 py-2 text-sm text-[var(--color-text-muted)]">{t("entry.searching")}</div>
          ) : filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-[var(--color-text-muted)]">
              {useApi && normalizedQuery.length < 2 ? "Type at least 2 characters to search." : "No matching faculty. Press Save to keep typed text."}
            </div>
          ) : (
            filteredOptions.map((option, index) => {
              const optionDisabled = disabledEmails.has(option.email.toLowerCase());
              return (
                <button
                  key={option.email}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (!optionDisabled) chooseOption(option);
                  }}
                  className={cx(
                    "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text-primary)] transition-colors",
                    index === highlightedIndex && !optionDisabled && "bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
                    optionDisabled
                      ? "pointer-events-none cursor-not-allowed text-[var(--color-text-muted)] opacity-50"
                      : "hover:bg-[var(--color-glass-hover)]"
                  )}
                >
                  {option.name}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
