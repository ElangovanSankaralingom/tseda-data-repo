"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
export { type SelectDropdownOption } from "@/lib/types/ui";
import { type SelectDropdownOption } from "@/lib/types/ui";
import { useTranslation } from "@/lib/i18n/useTranslation";

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

/* ── Portal-positioned listbox ── */
function DropdownPortal({
  anchorRef,
  portalRef,
  id,
  children,
}: {
  anchorRef: React.RefObject<HTMLDivElement | null>;
  portalRef: React.RefObject<HTMLDivElement | null>;
  id?: string;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  useLayoutEffect(() => {
    function update() {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos({
        top: rect.bottom + window.scrollY + 6,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [anchorRef]);

  return createPortal(
    <div
      ref={portalRef}
      id={id}
      role="listbox"
      className="max-h-56 overflow-auto rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-dropdown-bg)] backdrop-blur-2xl p-1 shadow-2xl"
      style={{
        position: "absolute",
        top: pos.top,
        left: pos.left,
        width: pos.width,
        zIndex: 9999,
      }}
    >
      {children}
    </div>,
    document.body
  );
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
  const { valueLabel } = useTranslation();

  const resolveLabel = useCallback((option: SelectDropdownOption): string => {
    const translated = valueLabel(option.value);
    return translated !== option.value ? translated : option.label;
  }, [valueLabel]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
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

    return options.filter((option) => resolveLabel(option).toLowerCase().includes(normalizedQuery));
  }, [hasTypedSinceOpen, inputText, options, resolveLabel]);
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
    open && hasTypedSinceOpen ? inputText : (selectedOption ? resolveLabel(selectedOption) : "");

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !containerRef.current?.contains(target) &&
        !portalRef.current?.contains(target)
      ) {
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
      {selectedOption?.icon && !open ? (
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 z-10">
          <selectedOption.icon className="size-4 text-[var(--color-text-secondary)]" />
        </div>
      ) : null}
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
            resolveLabel(option).toLowerCase().includes(nextValue.trim().toLowerCase())
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
          } else if (event.key === "Home") {
            event.preventDefault();
            if (open) setHighlightedIndex(firstEnabledIndex);
          } else if (event.key === "End") {
            event.preventDefault();
            if (open) {
              for (let i = filteredOptions.length - 1; i >= 0; i--) {
                if (!filteredOptions[i].disabled) { setHighlightedIndex(i); break; }
              }
            }
          } else if (event.key === " " && !hasTypedSinceOpen) {
            if (!open || resolvedHighlightedIndex < 0) return;
            const highlighted = filteredOptions[resolvedHighlightedIndex];
            if (!highlighted || highlighted.disabled) return;
            event.preventDefault();
            chooseOption(highlighted);
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
        aria-activedescendant={open && id && resolvedHighlightedIndex >= 0 ? `${id}-option-${resolvedHighlightedIndex}` : undefined}
        value={displayValue}
        className={cx(
          "w-full rounded-lg border bg-[var(--color-input-bg)] py-2 text-sm text-[var(--color-text-primary)] shadow-sm transition-all duration-200 outline-none focus-visible:ring-2 placeholder:text-[var(--color-text-muted)]",
          selectedOption?.icon && !open ? "pl-9 pr-3" : "px-3",
          error
            ? "border-[var(--color-status-error)] focus-visible:border-[var(--color-status-error)] focus-visible:ring-[var(--color-status-error-border)]"
            : "border-[var(--color-input-border)] hover:border-[var(--color-text-muted)] focus-visible:border-[var(--color-primary)] focus-visible:ring-[var(--color-primary)]/20",
          disabled && "pointer-events-none cursor-not-allowed opacity-60"
        )}
      />

      {open ? (
        <DropdownPortal anchorRef={containerRef} portalRef={portalRef} id={id ? `${id}-options` : undefined}>
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-[var(--color-text-muted)]">No matching options.</div>
          ) : (
            filteredOptions.map((option, index) => (
              <button
                key={option.value}
                id={id ? `${id}-option-${index}` : undefined}
                type="button"
                role="option"
                aria-selected={index === resolvedHighlightedIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseOption(option)}
                className={cx(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text-primary)] transition-colors",
                  index === resolvedHighlightedIndex && !option.disabled && "bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
                  option.disabled
                    ? "pointer-events-none cursor-not-allowed text-[var(--color-text-muted)] opacity-50"
                    : "hover:bg-[var(--color-glass-hover)]"
                )}
              >
                {option.icon ? <option.icon className="size-4 shrink-0 text-[var(--color-text-secondary)]" /> : null}
                {resolveLabel(option)}
              </button>
            ))
          )}
        </DropdownPortal>
      ) : null}
    </div>
  );
}
