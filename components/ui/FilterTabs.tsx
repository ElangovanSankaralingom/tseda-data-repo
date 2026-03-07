"use client";

import { cn } from "@/lib/utils";

export type FilterTab = {
  key: string;
  label: string;
  count?: number;
};

type FilterTabsProps = {
  tabs: FilterTab[];
  activeKey: string;
  onChange?: (key: string) => void;
  activeClassName?: string;
};

export default function FilterTabs({ tabs, activeKey, onChange, activeClassName }: FilterTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange?.(tab.key)}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 active:scale-[0.97]",
            tab.key === activeKey
              ? (activeClassName ?? "bg-slate-900 text-white shadow-sm") + " scale-100"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 scale-[0.97] hover:scale-100"
          )}
        >
          {tab.label}
          {tab.count !== undefined && tab.count > 0 ? (
            <span className={cn(
              "ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 text-xs transition-colors duration-200",
              tab.key === activeKey ? "bg-white/20" : "bg-slate-200"
            )}>
              {tab.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
