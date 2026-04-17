"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* ── Month/year helpers ── */
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function toISODateString(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDate(value: string | null | undefined): { year: number; month: number; day: number } | null {
  if (!value) return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]) - 1;
  const d = Number(parts[2]);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  return { year: y, month: m, day: d };
}

function formatDisplayDate(value: string | null | undefined): string {
  const parsed = parseDate(value);
  if (!parsed) return "";
  const { year, month, day } = parsed;
  return `${day} ${MONTH_NAMES[month]?.slice(0, 3)} ${year}`;
}

/* ── Calendar Grid ── */
function CalendarGrid({
  viewYear,
  viewMonth,
  selected,
  onSelect,
  onPrevMonth,
  onNextMonth,
}: {
  viewYear: number;
  viewMonth: number;
  selected: { year: number; month: number; day: number } | null;
  onSelect: (year: number, month: number, day: number) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const totalDays = daysInMonth(viewYear, viewMonth);
  const startDay = firstDayOfMonth(viewYear, viewMonth);
  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  const cells: Array<{ day: number; isCurrentMonth: boolean }> = [];

  // Leading blanks
  for (let i = 0; i < startDay; i++) {
    cells.push({ day: 0, isCurrentMonth: false });
  }
  // Days of month
  for (let d = 1; d <= totalDays; d++) {
    cells.push({ day: d, isCurrentMonth: true });
  }

  return (
    <div
      className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-dropdown-bg)] backdrop-blur-2xl p-3 shadow-2xl shadow-black/40"
      style={{ width: 280 }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Header — month/year + nav */}
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrevMonth}
          className="flex size-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-glass-hover)]"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" style={{ color: "var(--color-icon-default)" }} />
        </button>
        <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={onNextMonth}
          className="flex size-7 items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-glass-hover)]"
          aria-label="Next month"
        >
          <ChevronRight className="size-4" style={{ color: "var(--color-icon-default)" }} />
        </button>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DAY_LABELS.map((label) => (
          <div key={label} className="text-center text-[10px] font-bold uppercase" style={{ color: "var(--color-text-placeholder)" }}>
            {label}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((cell, i) => {
          if (!cell.isCurrentMonth) {
            return <div key={`blank-${i}`} className="size-8" />;
          }

          const isToday = viewYear === todayY && viewMonth === todayM && cell.day === todayD;
          const isSelected =
            selected !== null &&
            viewYear === selected.year &&
            viewMonth === selected.month &&
            cell.day === selected.day;

          return (
            <button
              key={cell.day}
              type="button"
              onClick={() => onSelect(viewYear, viewMonth, cell.day)}
              className={cx(
                "flex size-8 items-center justify-center rounded-lg text-xs font-medium transition-all duration-150",
                isSelected
                  ? "bg-[var(--color-primary)] text-white font-bold"
                  : isToday
                    ? "font-bold"
                    : "hover:bg-[var(--color-glass-hover)]"
              )}
              style={
                isSelected
                  ? { boxShadow: "0 0 10px var(--color-primary)" }
                  : isToday
                    ? { color: "var(--color-primary)", border: "1px solid var(--color-primary)" }
                    : { color: "var(--color-text-secondary)" }
              }
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main DateField ── */
export default function DateField({
  value,
  onChange,
  disabled,
  error,
  id,
}: {
  value: string | null | undefined;
  onChange: (next: string) => void;
  disabled?: boolean;
  error?: boolean;
  id?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const parsed = parseDate(value);

  const now = new Date();
  const [viewYear, setViewYear] = useState(parsed?.year ?? now.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? now.getMonth());

  const [portalPos, setPortalPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open) return;
    function update() {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPortalPos({
        top: rect.bottom + window.scrollY + 6,
        left: rect.left + window.scrollX,
      });
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  function handleSelect(year: number, month: number, day: number) {
    onChange(toISODateString(year, month, day));
    setOpen(false);
  }

  function prevMonth() {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }

  function nextMonth() {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Display input */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => {
            if (!o) {
              // Sync calendar view to current value when opening
              const p = parseDate(value);
              const n = new Date();
              setViewYear(p?.year ?? n.getFullYear());
              setViewMonth(p?.month ?? n.getMonth());
            }
            return !o;
          });
        }}
        className={cx(
          "flex w-full items-center gap-2 rounded-lg border bg-[var(--color-input-bg)] px-3 py-2 text-left text-sm shadow-sm transition-all duration-200 outline-none focus-visible:ring-2",
          error
            ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
            : "border-[var(--color-input-border)] hover:border-[var(--color-text-muted)] focus-visible:border-[var(--color-primary)] focus-visible:ring-[var(--color-primary)]/20",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        <Calendar className="size-4 shrink-0" style={{ color: "var(--color-icon-muted)" }} />
        <span style={{ color: value ? "var(--color-text-primary)" : "var(--color-text-muted)" }}>
          {value ? formatDisplayDate(value) : "Select date"}
        </span>
      </button>

      {/* Hidden native input to preserve form semantics */}
      <input type="hidden" name={id} value={value || ""} />

      {/* Portal calendar */}
      {open
        ? createPortal(
            <div
              style={{
                position: "absolute",
                top: portalPos.top,
                left: portalPos.left,
                zIndex: 9999,
              }}
            >
              <CalendarGrid
                viewYear={viewYear}
                viewMonth={viewMonth}
                selected={parsed}
                onSelect={handleSelect}
                onPrevMonth={prevMonth}
                onNextMonth={nextMonth}
              />
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
