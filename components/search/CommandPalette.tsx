"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Search as SearchIcon,
  ChevronRight,
  Zap,
  FileText,
  Users,
  FolderOpen,
  Layout,
  SearchX,
} from "lucide-react";
import {
  search,
  type SearchableItem,
  type SearchResult,
} from "@/lib/search/engine";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";

// ---------------------------------------------------------------------------
// Quick actions
// ---------------------------------------------------------------------------

import { CATEGORY_SLUGS } from "@/data/categoryRegistry";
import { type QuickAction } from "./searchTypes";

function buildQuickActions(tr: (key: string) => string, categoryLabel: (slug: string) => string): QuickAction[] {
  const categoryActions: QuickAction[] = CATEGORY_SLUGS.map((slug) => ({
    id: `qa-${slug}`,
    title: `${tr("entry.newEntry")} — ${categoryLabel(slug)}`,
    subtitle: tr("search.newEntryIn"),
    path: `/data-entry/${slug}/new`,
    icon: "file",
    adminOnly: false,
  }));
  return [
    ...categoryActions,
    { id: "qa-dash", title: tr("search.goToDashboard"), subtitle: tr("search.viewProgress"), path: "/dashboard", icon: "layout", adminOnly: false },
    { id: "qa-admin", title: tr("search.adminConsole"), subtitle: tr("search.administration"), path: "/admin", icon: "zap", adminOnly: true },
    { id: "qa-analytics", title: tr("search.viewAnalytics"), subtitle: tr("search.chartsAndInsights"), path: "/admin/analytics", icon: "zap", adminOnly: true },
    { id: "qa-export", title: tr("search.exportData"), subtitle: tr("search.downloadEntries"), path: "/admin/export", icon: "zap", adminOnly: true },
  ];
}

function ActionIcon({ type }: { type: string }) {
  switch (type) {
    case "zap":
      return <Zap className="size-4" />;
    case "file":
      return <FileText className="size-4" />;
    default:
      return <Layout className="size-4" />;
  }
}

// ---------------------------------------------------------------------------
// Result type icons
// ---------------------------------------------------------------------------

function TypeIcon({ type }: { type: SearchableItem["type"] }) {
  switch (type) {
    case "entry":
      return <FileText className="size-4 text-blue-500" />;
    case "user":
      return <Users className="size-4 text-emerald-500" />;
    case "category":
      return <FolderOpen className="size-4 text-amber-500" />;
    case "page":
      return <Layout className="size-4 text-[var(--color-text-secondary)]" />;
  }
}

function TypeBg({ type }: { type: SearchableItem["type"] }) {
  switch (type) {
    case "entry":
      return "bg-blue-500/15";
    case "user":
      return "bg-emerald-500/15";
    case "category":
      return "bg-amber-500/15";
    case "page":
      return "bg-[var(--color-dropdown-hover)]";
  }
}

// ---------------------------------------------------------------------------
// Highlight matched text
// ---------------------------------------------------------------------------

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const lower = text.toLowerCase();
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const ranges: [number, number][] = [];

  for (const word of words) {
    let pos = 0;
    while (pos < lower.length) {
      const idx = lower.indexOf(word, pos);
      if (idx === -1) break;
      ranges.push([idx, idx + word.length]);
      pos = idx + 1;
    }
  }

  if (ranges.length === 0) return <>{text}</>;

  // Merge overlapping ranges
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    if (ranges[i][0] <= last[1]) {
      last[1] = Math.max(last[1], ranges[i][1]);
    } else {
      merged.push(ranges[i]);
    }
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const [start, end] of merged) {
    if (cursor < start) {
      parts.push(text.slice(cursor, start));
    }
    parts.push(
      <mark key={start} className="rounded bg-amber-500/15 px-0.5 text-amber-900">
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  }
  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }
  return <>{parts}</>;
}

// ---------------------------------------------------------------------------
// Result item
// ---------------------------------------------------------------------------

function getResultTitle(item: SearchableItem): string {
  switch (item.type) {
    case "entry":
      return item.title;
    case "user":
      return item.name;
    case "category":
      return item.name;
    case "page":
      return item.name;
  }
}

function getResultSubtitle(item: SearchableItem): string {
  switch (item.type) {
    case "entry":
      return `${item.categoryLabel} · ${item.status}`;
    case "user":
      return `${item.email} · ${item.entryCount} entries`;
    case "category":
      return `${item.entryCount} entries`;
    case "page":
      return item.description;
  }
}

function getResultHref(item: SearchableItem): string {
  switch (item.type) {
    case "entry":
      return item.href;
    case "user":
      return item.href;
    case "category":
      return item.href;
    case "page":
      return item.path;
  }
}

function getTypeLabels(tr: (key: string) => string): Record<SearchableItem["type"], string> {
  return {
    entry: tr("search.sectionEntries"),
    user: tr("search.sectionUsers"),
    category: tr("search.sectionCategories"),
    page: tr("search.sectionPages"),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type CommandPaletteProps = {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
};

export default function CommandPalette({
  isOpen,
  onClose,
  isAdmin,
}: CommandPaletteProps) {
  const router = useRouter();
  const { t, categoryLabel } = useTranslation();
  const QUICK_ACTIONS = useMemo(() => buildQuickActions(t as (key: string) => string, categoryLabel), [t, categoryLabel]);
  const TYPE_LABELS = useMemo(() => getTypeLabels(t as (key: string) => string), [t]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<SearchableItem[]>([]);
  const [indexLoaded, setIndexLoaded] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [activeFilters, setActiveFilters] = useState<Set<SearchableItem["type"]>>(new Set());

  // Load search index on first open
  useEffect(() => {
    if (!isOpen || indexLoaded) return;
    let cancelled = false;
    void fetch("/api/search")
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (!cancelled) {
          setIndex(json.data ?? []);
          setIndexLoaded(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen, indexLoaded]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
      setQuery("");
      setSelectedIdx(0);
    }
  }, [isOpen]);

  // Search results
  const results = useMemo(() => {
    if (!query.trim()) return [];
    const filters = activeFilters.size > 0 ? { types: Array.from(activeFilters) } : undefined;
    return search(query, index, filters, 25);
  }, [query, index, activeFilters]);

  // Group results by type
  const grouped = useMemo(() => {
    const groups: { type: SearchableItem["type"]; items: SearchResult[] }[] = [];
    const typeOrder: SearchableItem["type"][] = ["entry", "user", "category", "page"];
    for (const type of typeOrder) {
      const items = results.filter((r) => r.item.type === type);
      if (items.length > 0) {
        groups.push({ type, items: items.slice(0, 8) });
      }
    }
    return groups;
  }, [results]);

  // Flat list for keyboard navigation
  const flatItems = useMemo(() => {
    if (query.trim()) {
      return grouped.flatMap((g) => g.items);
    }
    // Empty query: quick actions
    const actions = QUICK_ACTIONS.filter((a) => !a.adminOnly || isAdmin);
    return actions.map((a) => ({
      item: { type: "page" as const, id: a.id, name: a.title, path: a.path, description: a.subtitle, adminOnly: a.adminOnly },
      score: 0,
      matches: [],
    })) as SearchResult[];
  }, [query, grouped, isAdmin, QUICK_ACTIONS]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIdx(0);
  }, [query, activeFilters]);

  // Navigate to result
  const navigate = useCallback(
    (item: SearchableItem) => {
      const href = getResultHref(item);
      router.push(href);
      onClose();
    },
    [router, onClose],
  );

  // Keyboard handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => (i + 1) % Math.max(flatItems.length, 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => (i - 1 + flatItems.length) % Math.max(flatItems.length, 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = flatItems[selectedIdx];
        if (selected) navigate(selected.item);
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (query) {
          setQuery("");
        } else {
          onClose();
        }
      }
    },
    [flatItems, selectedIdx, navigate, onClose, query],
  );

  // Scroll selected into view
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const selected = container.querySelector("[data-selected='true']");
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIdx]);

  // Toggle filter
  const toggleFilter = useCallback((type: SearchableItem["type"]) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  if (!isOpen) return null;

  const hasQuery = query.trim().length > 0;
  const quickActions = QUICK_ACTIONS.filter((a) => !a.adminOnly || isAdmin);

  // Track flat index for keyboard nav
  let flatIdx = 0;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-[var(--color-modal-overlay)] backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />

      {/* Palette */}
      <div
        className="fixed left-1/2 top-[12%] z-50 w-full max-w-2xl -translate-x-1/2 px-4 sm:px-0 animate-fade-in-up"
        role="dialog"
        aria-label="Search"
      >
        <div
          className="overflow-hidden rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-modal-bg)] shadow-2xl"
          onKeyDown={handleKeyDown}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-[var(--color-glass-border)] px-5 h-14">
            <SearchIcon className="size-5 shrink-0 text-[var(--color-text-secondary)]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isAdmin ? "Search entries, actions, admin..." : "Search entries, actions..."}
              aria-label="Search commands"
              className="h-full flex-1 bg-transparent text-lg outline-none placeholder:text-[var(--color-text-secondary)]"
            />
            <kbd className="hidden rounded bg-[var(--color-input-bg)] px-1.5 py-0.5 text-xs text-[var(--color-text-secondary)] sm:inline-block">
              ESC
            </kbd>
          </div>

          {/* Filter chips */}
          {hasQuery && (
            <div className="flex gap-1.5 border-b border-[var(--color-divider)] px-5 py-2">
              {(["entry", "user", "category", "page"] as const).map((type) => {
                if (type === "user" && !isAdmin) return null;
                const active = activeFilters.has(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleFilter(type)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      active
                        ? "bg-[var(--color-button-primary-bg)] text-white"
                        : "bg-[var(--color-dropdown-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-dropdown-hover)]",
                    )}
                  >
                    {TYPE_LABELS[type]}
                  </button>
                );
              })}
            </div>
          )}

          {/* Results */}
          <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
            {hasQuery ? (
              results.length > 0 ? (
                <div className="py-2">
                  {grouped.map((group) => (
                    <div key={group.type}>
                      <div className="px-5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                        {TYPE_LABELS[group.type]} ({group.items.length})
                      </div>
                      {group.items.map((result) => {
                        const idx = flatIdx++;
                        const isSelected = idx === selectedIdx;
                        return (
                          <button
                            key={result.item.id}
                            data-selected={isSelected}
                            onClick={() => navigate(result.item)}
                            className={cn(
                              "flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors",
                              isSelected ? "bg-[var(--color-dropdown-hover)]" : "hover:bg-[var(--color-dropdown-hover)]",
                            )}
                          >
                            <div
                              className={cn(
                                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                                TypeBg({ type: result.item.type }),
                              )}
                            >
                              <TypeIcon type={result.item.type} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                                <HighlightedText
                                  text={getResultTitle(result.item)}
                                  query={query}
                                />
                              </div>
                              <div className="truncate text-xs text-[var(--color-text-secondary)]">
                                {getResultSubtitle(result.item)}
                              </div>
                            </div>
                            <ChevronRight className="size-4 shrink-0 text-[var(--color-text-muted)]" />
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                /* No results */
                <div className="flex flex-col items-center gap-2 py-12">
                  <SearchX className="size-8 text-[var(--color-text-muted)]" />
                  <div className="text-sm text-[var(--color-text-secondary)]">
                    {`${t('common.noResults')} "${query}"`}
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)]">
                    Try different keywords or check your spelling
                  </div>
                </div>
              )
            ) : (
              /* Empty query: quick actions */
              <div className="py-2">
                <div className="px-5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Quick Actions
                </div>
                {quickActions.map((action, i) => {
                  const isSelected = i === selectedIdx;
                  return (
                    <button
                      key={action.id}
                      data-selected={isSelected}
                      onClick={() => {
                        router.push(action.path);
                        onClose();
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors",
                        isSelected ? "bg-[var(--color-dropdown-hover)]" : "hover:bg-[var(--color-dropdown-hover)]",
                      )}
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-input-bg)]">
                        <ActionIcon type={action.icon} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                          {action.title}
                        </div>
                        <div className="truncate text-xs text-[var(--color-text-secondary)]">
                          {action.subtitle}
                        </div>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-[var(--color-text-muted)]" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] px-5 py-2">
            <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-secondary)]">
              <span>↑↓ Navigate</span>
              <span>↵ Open</span>
              <span>ESC Close</span>
            </div>
            {hasQuery && (
              <span className="text-[10px] text-[var(--color-text-secondary)]">
                {results.length} {results.length === 1 ? "result" : "results"}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
