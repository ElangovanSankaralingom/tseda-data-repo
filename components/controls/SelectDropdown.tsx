"use client";

import { useEffect, useMemo, useRef, useState } from "react";
export { type SelectDropdownOption } from "@/lib/types/ui";
import { type SelectDropdownOption } from "@/lib/types/ui";

type SelectDropdownProps = {
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectDropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  id?: string;
  name?: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function SelectDropdown({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  error,
  id,
  name,
}: SelectDropdownProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [inputText, setInputText] = useState("");
  const [hasTypedSinceOpen, setHasTypedSinceOpen] = useState(false);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    if (!hasTypedSinceOpen) return options;

    const normalizedQuery = inputText.trim().toLowerCase();
    if (!normalizedQuery) return options;

    return options.filter((option) => option.label.toLowerCase().includes(normalizedQuery));
  }, [hasTypedSinceOpen, inputText, options]);
  const defaultHighlightedIndex = filteredOptions.findIndex(
    (option) => option.value === value && !option.disabled
  );
  const firstEnabledIndex = filteredOptions.findIndex((option) => !option.disabled);
  const resolvedHighlightedIndex =
    highlightedIndex >= 0 &&
    highlightedIndex < filteredOptions.length &&
    !filteredOptions[highlightedIndex]?.disabled
      ? highlightedIndex
      : defaultHighlightedIndex >= 0
        ? defaultHighlightedIndex
        : firstEnabledIndex;
  const displayValue =
    open && hasTypedSinceOpen ? inputText : (selectedOption?.label ?? "");

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function chooseOption(option: SelectDropdownOption) {
    if (disabled || option.disabled) return;
    onChange(option.value);
    setInputText("");
    setHasTypedSinceOpen(false);
    setHighlightedIndex(-1);
    setOpen(false);
  }

  function moveHighlight(step: 1 | -1) {
    if (filteredOptions.length === 0) return;

    let nextIndex = highlightedIndex;
    for (let count = 0; count < filteredOptions.length; count += 1) {
      nextIndex = (nextIndex + step + filteredOptions.length) % filteredOptions.length;
      if (!filteredOptions[nextIndex].disabled) {
        setHighlightedIndex(nextIndex);
        return;
      }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {name && <input type="hidden" name={name} value={value} />}
      <input
        id={id}
        ref={inputRef}
        onFocus={() => {
          if (disabled) return;
          setOpen(true);
          setHasTypedSinceOpen(false);
          setInputText("");
          setHighlightedIndex(defaultHighlightedIndex >= 0 ? defaultHighlightedIndex : firstEnabledIndex);
          window.requestAnimationFrame(() => inputRef.current?.select());
        }}
        onChange={(event) => {
          if (disabled) return;
          const nextValue = event.target.value;
          const nextFilteredOptions = options.filter((option) =>
            option.label.toLowerCase().includes(nextValue.trim().toLowerCase())
          );
          const nextEnabledIndex = nextFilteredOptions.findIndex((option) => !option.disabled);
          setInputText(nextValue);
          setHasTypedSinceOpen(true);
          setHighlightedIndex(nextEnabledIndex);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (disabled) return;

          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (!open) {
              setOpen(true);
              setHasTypedSinceOpen(false);
              setHighlightedIndex(defaultHighlightedIndex >= 0 ? defaultHighlightedIndex : firstEnabledIndex);
              return;
            }
            moveHighlight(1);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) {
              setOpen(true);
              setHasTypedSinceOpen(false);
              setHighlightedIndex(defaultHighlightedIndex >= 0 ? defaultHighlightedIndex : firstEnabledIndex);
              return;
            }
            moveHighlight(-1);
          } else if (event.key === "Enter") {
            if (!open || resolvedHighlightedIndex < 0) return;
            const highlighted = filteredOptions[resolvedHighlightedIndex];
            if (!highlighted || highlighted.disabled) return;
            event.preventDefault();
            chooseOption(highlighted);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setInputText("");
            setHasTypedSinceOpen(false);
            setHighlightedIndex(-1);
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        readOnly={disabled}
        role="combobox"
        aria-invalid={error || undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        aria-controls={id ? `${id}-options` : undefined}
        value={displayValue}
        className={cx(
          "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm transition-colors outline-none focus-visible:ring-2 placeholder:text-slate-500",
          error
            ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
            : "border-slate-300 hover:border-slate-400 focus-visible:border-[#1E3A5F] focus-visible:ring-[#1E3A5F]/20",
          disabled && "pointer-events-none cursor-not-allowed opacity-60"
        )}
      />

      {open ? (
        <div
          id={id ? `${id}-options` : undefined}
          role="listbox"
          className="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
        >
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No matching options.</div>
          ) : (
            filteredOptions.map((option, index) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={index === resolvedHighlightedIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseOption(option)}
                className={cx(
                  "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm",
                  index === resolvedHighlightedIndex && !option.disabled && "bg-muted",
                  option.disabled
                    ? "pointer-events-none cursor-not-allowed text-muted-foreground opacity-50"
                    : "hover:bg-muted"
                )}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
