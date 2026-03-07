import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AdminPageShell from "@/components/admin/AdminPageShell";
import SectionCard from "@/components/layout/SectionCard";
import { authOptions } from "@/lib/auth";
import { canAccessAdminSearch } from "@/lib/admin/roles";
import { CATEGORY_LIST, getCategoryConfig, isValidCategorySlug } from "@/data/categoryRegistry";
import { toUserMessage } from "@/lib/errors";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminHome, dashboard } from "@/lib/entryNavigation";
import { searchAllUsers, type SearchResult } from "@/lib/search/searchIndex";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type AdminSearchPageProps = {
  searchParams?: Promise<SearchParams>;
};

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function getCategory(raw: string): CategoryKey | "all" {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "all") return "all";
  if (isValidCategorySlug(normalized)) return normalized;
  return "all";
}

export default async function AdminSearchPage({ searchParams }: AdminSearchPageProps) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!canAccessAdminSearch(email)) {
    redirect(dashboard());
  }

  const params = searchParams ? await searchParams : {};
  const query = getParam(params, "q").trim();
  const userEmail = getParam(params, "userEmail").trim();
  const selectedCategory = getCategory(getParam(params, "category"));

  let error: string | null = null;
  let results: SearchResult[] = [];
  if (query) {
    const result = await searchAllUsers(query, {
      category: selectedCategory,
      userEmail,
      actorEmail: email,
      limit: 200,
    });
    if (result.ok) {
      results = result.data;
    } else {
      error = toUserMessage(result.error);
    }
  }

  return (
    <AdminPageShell
      title="Admin Search"
      subtitle="Search entries across all users and categories."
      backHref={adminHome()}
      maxWidthClassName="max-w-6xl"
    >
      <SectionCard>
        <form method="GET">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_240px_auto]">
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
                defaultValue={selectedCategory}
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
            <label className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Owner Email (optional)</span>
              <input
                name="userEmail"
                defaultValue={userEmail}
                placeholder="faculty@tce.edu"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-foreground/40"
              />
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

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {query ? (
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
                  key={`${result.userEmail}:${result.category}:${result.entryId}`}
                  href={result.href}
                  className="block rounded-xl border border-border p-3 transition hover:bg-muted/40"
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">{result.title}</div>
                    <div className="text-xs text-muted-foreground">{result.updatedAt || "-"}</div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {result.userEmail} • {result.categoryLabel} • {result.status}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      ) : null}
    </AdminPageShell>
  );
}
