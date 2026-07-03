import { getServerSession } from "next-auth";
import EntrySearchClient from "@/components/search/EntrySearchClient";
import { isValidCategorySlug } from "@/data/categoryRegistry";
import { authOptions } from "@/lib/auth";
import { inUserUniverse } from "@/lib/demo/demoAware";
import { toUserMessage } from "@/lib/errors";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { searchUserEntries, type SearchResult } from "@/lib/search/searchIndex";

export const dynamic = "force-dynamic";

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
    // Server-side read → runs in the caller's universe (real or demo).
    const result = await inUserUniverse(email, () =>
      searchUserEntries(email, query, {
        category: selectedCategory,
        limit: 100,
      }),
    );
    if (result.ok) {
      results = result.data;
    } else {
      error = toUserMessage(result.error);
    }
  }

  return (
    <EntrySearchClient
      query={query}
      categoryValue={categoryValue}
      results={results}
      error={error}
    />
  );
}
