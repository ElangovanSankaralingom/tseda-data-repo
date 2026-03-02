"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  options: FacultyOption[];
  disabledEmails: Set<string>;
  placeholder?: string;
  error?: boolean;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function FacultySelect({
  value,
  onChange,
  options,
  disabledEmails,
  placeholder,
  error,
}: FacultySelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputValue = value.name;
  const normalizedQuery = inputValue.trim().toLowerCase();

  const filteredOptions = useMemo(() => {
    return options.filter((option) => {
      if (!normalizedQuery) return true;
      return (
        option.name.toLowerCase().includes(normalizedQuery) ||
        option.email.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [options, normalizedQuery]);

  const firstEnabledIndex = filteredOptions.findIndex(
    (option) => !disabledEmails.has(option.email.toLowerCase())
  );

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

  function chooseOption(option: FacultyOption) {
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
          setOpen(true);
          setHighlightedIndex(firstEnabledIndex);
        }}
        onChange={(event) => {
          onChange({ name: event.target.value, email: "" });
          setOpen(true);
          setHighlightedIndex(firstEnabledIndex);
        }}
        onKeyDown={(event) => {
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
        className={cx(
          "w-full rounded-lg border bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2",
          error
            ? "border-red-300 focus-visible:border-red-300 focus-visible:ring-red-200/70"
            : "border-border hover:border-ring/50 focus-visible:border-ring focus-visible:ring-ring/20"
        )}
      />

      {open ? (
        <div className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-border bg-background p-1 shadow-lg">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No matching faculty. Press Save to keep typed text.
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
                    "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm",
                    index === highlightedIndex && !optionDisabled && "bg-muted",
                    optionDisabled
                      ? "pointer-events-none cursor-not-allowed text-muted-foreground opacity-50"
                      : "hover:bg-muted"
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
