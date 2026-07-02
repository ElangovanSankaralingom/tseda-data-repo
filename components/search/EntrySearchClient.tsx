"use client";

import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import SearchCategorySelect from "@/components/controls/SearchCategorySelect";
import { CATEGORY_LIST } from "@/data/categoryRegistry";
import { dashboard } from "@/lib/entryNavigation";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { SearchResult } from "@/lib/search/searchIndex";
import type { CategoryKey } from "@/lib/entries/types";

type EntrySearchClientProps = {
  query: string;
  categoryValue: CategoryKey | "all";
  results: SearchResult[];
  error: string | null;
};

/** Presentational half of the entry search page — client component so every
 *  label follows the user's language (the chrome was hardcoded English in
 *  the server page, 2026-07 layout-consistency fix). */
export default function EntrySearchClient({ query, categoryValue, results, error }: EntrySearchClientProps) {
  const { t, categoryLabel } = useTranslation();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 space-y-6">
      <PageHeader
        title={t("entry.searchPageTitle")}
        subtitle={t("entry.searchPageSubtitle")}
        backHref={dashboard()}
        showBack
      />

      <SectionCard>
        <form method="GET">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--color-text-muted)]">{t("adminPages.keyword")}</span>
              <input
                name="q"
                defaultValue={query}
                placeholder={t("adminPages.searchPlaceholder")}
                className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--color-text-muted)]">{t("adminPages.category")}</span>
              <SearchCategorySelect
                name="category"
                defaultValue={categoryValue}
                options={[
                  { label: t("adminPages.allCategories"), value: "all" },
                  ...CATEGORY_LIST.map((category) => ({
                    label: categoryLabel(category),
                    value: category,
                  })),
                ]}
                placeholder={t("adminPages.allCategories")}
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--color-glass-border)] px-4 text-sm font-medium transition hover:bg-[var(--color-glass-hover)]/60"
              >
                {t("adminPages.searchButton")}
              </button>
            </div>
          </div>
        </form>
      </SectionCard>

      {error ? (
        <div className="rounded-xl border border-[var(--color-status-error-border)] bg-[var(--color-status-error-bg)] px-3 py-2 text-sm text-[var(--color-status-error)] animate-error-in">
          {error}
        </div>
      ) : null}

      {query ? (
        <SectionCard
          title={t("adminPages.searchResults")}
          subtitle={t("entry.searchResultsCount").replace("{n}", String(results.length))}
        >
          {results.length === 0 ? (
            <div className="text-sm text-[var(--color-text-muted)]">{t("adminPages.noEntriesMatched")}</div>
          ) : (
            <div className="space-y-3">
              {results.map((result) => (
                <Link
                  key={`${result.category}:${result.entryId}`}
                  href={result.href}
                  className="block rounded-xl border border-[var(--color-glass-border)] p-3 transition hover:bg-[var(--color-glass-hover)]/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">{result.title}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{result.updatedAt || "-"}</div>
                  </div>
                  <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {result.categoryLabel} • {result.status}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}
    </div>
  );
}
