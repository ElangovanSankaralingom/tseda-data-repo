"use client";

import { cn } from "@/lib/utils";
export { type FilterTab } from "@/lib/types/ui";
import { type FilterTab } from "@/lib/types/ui";

export default function FilterTabs({ tabs, activeKey, onChange, activeClassName }: {
  tabs: FilterTab[];
  activeKey: string;
  onChange?: (key: string) => void;
  activeClassName?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange?.(tab.key)}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 active:scale-[0.97]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40",
            tab.key === activeKey
              ? (activeClassName ?? "bg-[var(--color-button-primary-bg)] text-[var(--color-text-on-accent)] shadow-sm") + " scale-100"
              : "bg-[var(--color-surface-panel-tile)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)] hover:bg-[var(--color-badge-bg)] hover:text-[var(--color-text-primary)] scale-[0.97] hover:scale-100"
          )}
        >
          {tab.label}
          {tab.count !== undefined && tab.count > 0 ? (
            <span className={cn(
              "ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 text-xs transition-colors duration-200",
              tab.key === activeKey ? "bg-[var(--color-surface-on-accent-strong)]" : "bg-[var(--color-dropdown-hover)]"
            )}>
              {tab.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
