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
        className="hidden items-center gap-2 rounded-full bg-[var(--color-dropdown-hover)] border border-[var(--color-glass-border)] px-3 h-9 w-48 cursor-pointer transition-all duration-200 hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-glass-hover)] lg:flex"
      >
        <Search className="size-4 text-[var(--color-text-muted)]" />
        <span className="flex-1 text-left text-sm text-[var(--color-text-muted)]">Search...</span>
        <kbd className="rounded-md bg-[var(--color-glass-bg)] border border-[var(--color-glass-border)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-text-muted)]">⌘K</kbd>
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
