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
};

export default function FilterTabs({ tabs, activeKey, onChange }: FilterTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange?.(tab.key)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            tab.key === activeKey
              ? "bg-[#1E3A5F] text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          )}
        >
          {tab.label}
          {tab.count !== undefined && tab.count > 0 ? ` (${tab.count})` : ""}
        </button>
      ))}
    </div>
  );
}
