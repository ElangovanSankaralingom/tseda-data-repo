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
        className="hidden items-center gap-2 rounded-xl bg-[var(--color-dropdown-hover)] px-3 h-9 w-48 cursor-pointer transition-colors hover:bg-[var(--color-body-bg)] lg:flex"
      >
        <Search className="size-4 text-[var(--color-text-secondary)]" />
        <span className="flex-1 text-left text-sm text-[var(--color-text-secondary)]">Search...</span>
        <kbd className="rounded bg-[var(--color-card-bg)] px-1.5 py-0.5 text-xs text-[var(--color-text-secondary)] shadow-sm">⌘K</kbd>
      </button>
      {/* Mobile/tablet: icon only */}
      <button
        type="button"
        onClick={open}
        className="flex size-9 items-center justify-center rounded-xl transition-colors hover:bg-[var(--color-dropdown-hover)] lg:hidden"
        aria-label="Search (⌘K)"
        title="Search (⌘K)"
      >
        <Search className="size-[18px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors" />
      </button>
    </>
  );
}
