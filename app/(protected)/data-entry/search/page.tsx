import Link from "next/link";
import { getServerSession } from "next-auth";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { CATEGORY_LIST, getCategoryConfig, isValidCategorySlug } from "@/data/categoryRegistry";
import { authOptions } from "@/lib/auth";
import { toUserMessage } from "@/lib/errors";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { dataEntryHome } from "@/lib/entryNavigation";
import { searchUserEntries, type SearchResult } from "@/lib/search/searchIndex";

type SearchParams = Record<string, string | string[] | undefined>;

type DataEntrySearchPageProps = {
  searchParams?: Promise<SearchParams>;
};

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function getSelectedCategory(raw: string): CategoryKey | "all" {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "all") return "all";
  if (isValidCategorySlug(normalized)) return normalized;
  return "all";
}

export default async function DataEntrySearchPage({ searchParams }: DataEntrySearchPageProps) {
  const params = searchParams ? await searchParams : {};
  const query = getParam(params, "q").trim();
  const selectedCategory = getSelectedCategory(getParam(params, "category"));
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  const categoryValue = selectedCategory === "all" ? "all" : selectedCategory;

  let error: string | null = null;
  let results: SearchResult[] = [];
  if (email && query) {
    const result = await searchUserEntries(email, query, {
      category: selectedCategory,
      limit: 100,
    });
    if (result.ok) {
      results = result.data;
    } else {
      error = toUserMessage(result.error);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <PageHeader
        title="Entry Search"
        subtitle="Search your entries across categories using keywords."
        backHref={dataEntryHome()}
        showBack
      />

      <div className="mt-6">
        <SectionCard>
          <form method="GET">
            <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Keyword</span>
                <input
                  name="q"
                  defaultValue={query}
                  placeholder="Search by title, category, or field values"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-foreground/40"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Category</span>
                <select
                  name="category"
                  defaultValue={categoryValue}
                  className="select-styled w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition-colors hover:border-slate-400 focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/20"
                >
                  <option value="all">All categories</option>
                  {CATEGORY_LIST.map((category) => (
                    <option key={category} value={category}>
                      {getCategoryConfig(category).label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-4 text-sm font-medium transition hover:bg-muted/60"
                >
                  Search
                </button>
              </div>
            </div>
          </form>
        </SectionCard>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {query ? (
        <div className="mt-5">
          <SectionCard
            title="Search Results"
            subtitle={`Results: ${results.length}`}
          >
            {results.length === 0 ? (
              <div className="text-sm text-muted-foreground">No entries matched this search.</div>
            ) : (
              <div className="space-y-3">
                {results.map((result) => (
                  <Link
                    key={`${result.category}:${result.entryId}`}
                    href={result.href}
                    className="block rounded-xl border border-border p-3 transition hover:bg-muted/40"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium">{result.title}</div>
                      <div className="text-xs text-muted-foreground">{result.updatedAt || "-"}</div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {result.categoryLabel} • {result.status}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
