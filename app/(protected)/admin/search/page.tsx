import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import AdminPageShell from "@/components/admin/AdminPageShell";
import SearchCategorySelect from "@/components/controls/SearchCategorySelect";
import SectionCard from "@/components/layout/SectionCard";
import { authOptions } from "@/lib/auth";
import { canAccessAdminSearch } from "@/lib/admin/roles";
import { CATEGORY_LIST, getCategoryConfig, isValidCategorySlug } from "@/data/categoryRegistry";
import { toUserMessage } from "@/lib/errors";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { adminHome, dashboard } from "@/lib/entryNavigation";
import { searchAllUsers, type SearchResult } from "@/lib/search/searchIndex";
import { t } from "@/lib/i18n";

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

  const s = (key: Parameters<typeof t>[0]) => t(key, "en");

  return (
    <AdminPageShell
      titleKey="adminPages.searchTitle"
      subtitleKey="adminPages.searchSubtitle"
      backHref={adminHome()}
      iconName="Search"
      maxWidthClassName="max-w-6xl"
    >
      <SectionCard>
        <form method="GET">
          <div className="grid gap-3 md:grid-cols-[1fr_220px_240px_auto]">
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--color-text-muted)]">{s("adminPages.keyword")}</span>
              <input
                name="q"
                defaultValue={query}
                placeholder={s("adminPages.searchPlaceholder")}
                className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--color-text-muted)]">{s("adminPages.category")}</span>
              <SearchCategorySelect
                name="category"
                defaultValue={selectedCategory}
                options={[
                  { label: s("adminPages.allCategories"), value: "all" },
                  ...CATEGORY_LIST.map((category) => ({
                    label: getCategoryConfig(category).label,
                    value: category,
                  })),
                ]}
                placeholder={s("adminPages.allCategories")}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-[var(--color-text-muted)]">{s("adminPages.ownerEmail")}</span>
              <input
                name="userEmail"
                defaultValue={userEmail}
                placeholder={s("adminPages.emailPlaceholder")}
                className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[var(--color-glass-border)] px-4 text-sm font-medium transition hover:bg-[var(--color-glass-hover)]/60"
              >
                {s("adminPages.searchButton")}
              </button>
            </div>
          </div>
        </form>
      </SectionCard>

      {error ? (
        <div className="mt-4 rounded-xl border border-[var(--color-status-error-border)] bg-[var(--color-status-error-bg)] px-3 py-2 text-sm text-[var(--color-status-error)]">
          {error}
        </div>
      ) : null}

      {query ? (
        <SectionCard
          title={s("adminPages.searchResults")}
          subtitle={`${results.length}`}
        >
          {results.length === 0 ? (
            <div className="text-sm text-[var(--color-text-muted)]">{s("adminPages.noEntriesMatched")}</div>
          ) : (
            <div className="space-y-3">
              {results.map((result) => (
                <Link
                  key={`${result.userEmail}:${result.category}:${result.entryId}`}
                  href={result.href}
                  className="block rounded-xl border border-[var(--color-glass-border)] p-3 transition hover:bg-[var(--color-glass-hover)]/40"
                  target="_blank"
                  rel="noreferrer"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">{result.title}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{result.updatedAt || "-"}</div>
                  </div>
                  <div className="mt-1 text-xs text-[var(--color-text-muted)]">
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
