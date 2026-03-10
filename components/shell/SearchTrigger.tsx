"use client";

import { Search } from "lucide-react";
import { useSearch } from "@/components/search/SearchProvider";

export default function SearchTrigger() {
  const { open } = useSearch();
  return (
    <>
      {/* Desktop: search bar */}
      <button
        type="button"
        onClick={open}
        className="hidden items-center gap-2 rounded-xl bg-slate-100 px-3 h-9 w-48 cursor-pointer transition-colors hover:bg-slate-200 lg:flex"
      >
        <Search className="size-4 text-slate-500" />
        <span className="flex-1 text-left text-sm text-slate-500">Search...</span>
        <kbd className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-500 shadow-sm">⌘K</kbd>
      </button>
      {/* Mobile/tablet: icon only */}
      <button
        type="button"
        onClick={open}
        className="flex size-9 items-center justify-center rounded-xl transition-colors hover:bg-slate-100 lg:hidden"
        aria-label="Search (⌘K)"
        title="Search (⌘K)"
      >
        <Search className="size-[18px] text-slate-500 hover:text-slate-900 transition-colors" />
      </button>
    </>
  );
}
