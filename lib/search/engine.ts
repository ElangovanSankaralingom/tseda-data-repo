/**
 * Client-side fuzzy search engine. No external dependencies.
 * Works on pre-built SearchableItem arrays passed from the server.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SearchableEntry = {
  type: "entry";
  id: string;
  email: string;
  category: string;
  categoryLabel: string;
  status: string;
  title: string;
  content: string;
  streakEligible: boolean;
  createdAt: string;
  updatedAt: string;
  href: string;
};

export type SearchableUser = {
  type: "user";
  id: string;
  email: string;
  name: string;
  entryCount: number;
  streakWins: number;
  href: string;
};

export type SearchableCategory = {
  type: "category";
  id: string;
  slug: string;
  name: string;
  entryCount: number;
  href: string;
};

export type SearchablePage = {
  type: "page";
  id: string;
  name: string;
  path: string;
  description: string;
  adminOnly: boolean;
};

export type SearchableItem =
  | SearchableEntry
  | SearchableUser
  | SearchableCategory
  | SearchablePage;

export type SearchMatch = {
  field: string;
  indices: [number, number][];
};

export type SearchResult = {
  item: SearchableItem;
  score: number;
  matches: SearchMatch[];
};

export type SearchFilters = {
  types?: SearchableItem["type"][];
  categories?: string[];
  statuses?: string[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

function findMatchIndices(text: string, query: string): [number, number][] {
  const indices: [number, number][] = [];
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let start = 0;
  while (start < lower.length) {
    const idx = lower.indexOf(q, start);
    if (idx === -1) break;
    indices.push([idx, idx + q.length]);
    start = idx + 1;
  }
  return indices;
}

function editDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (Math.abs(a.length - b.length) > 2) return 3;

  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

function isRecent(dateStr: string, days: number): boolean {
  const diff = Date.now() - Date.parse(dateStr);
  return Number.isFinite(diff) && diff < days * 86_400_000;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function getSearchableFields(item: SearchableItem): { field: string; text: string; weight: number }[] {
  switch (item.type) {
    case "entry":
      return [
        { field: "title", text: item.title, weight: 100 },
        { field: "categoryLabel", text: item.categoryLabel, weight: 80 },
        { field: "status", text: item.status, weight: 40 },
        { field: "content", text: item.content, weight: 10 },
      ];
    case "user":
      return [
        { field: "name", text: item.name, weight: 100 },
        { field: "email", text: item.email, weight: 80 },
      ];
    case "category":
      return [
        { field: "name", text: item.name, weight: 100 },
        { field: "slug", text: item.slug, weight: 60 },
      ];
    case "page":
      return [
        { field: "name", text: item.name, weight: 100 },
        { field: "description", text: item.description, weight: 40 },
      ];
  }
}

function scoreItem(
  item: SearchableItem,
  queryWords: string[],
): { score: number; matches: SearchMatch[] } {
  const fields = getSearchableFields(item);
  let totalScore = 0;
  const matches: SearchMatch[] = [];

  for (const queryWord of queryWords) {
    let bestWordScore = 0;

    for (const { field, text, weight } of fields) {
      const lower = normalize(text);
      let fieldScore = 0;

      // Exact full match
      if (lower === queryWord) {
        fieldScore = weight;
      }
      // Prefix match (word starts with query)
      else if (lower.startsWith(queryWord)) {
        fieldScore = weight * 0.8;
      }
      // Contains match
      else if (lower.includes(queryWord)) {
        fieldScore = weight * 0.5;
      }
      // Check individual words in the field for prefix match
      else {
        const words = lower.split(/\s+/);
        for (const word of words) {
          if (word.startsWith(queryWord)) {
            fieldScore = Math.max(fieldScore, weight * 0.6);
          } else if (queryWord.length >= 3 && editDistance(word.slice(0, queryWord.length + 1), queryWord) <= 1) {
            fieldScore = Math.max(fieldScore, weight * 0.2);
          }
        }
      }

      if (fieldScore > bestWordScore) {
        bestWordScore = fieldScore;
      }

      // Track match locations for highlighting
      if (fieldScore > 0) {
        const indices = findMatchIndices(text, queryWord);
        if (indices.length > 0) {
          const existing = matches.find((m) => m.field === field);
          if (existing) {
            existing.indices.push(...indices);
          } else {
            matches.push({ field, indices });
          }
        }
      }
    }

    totalScore += bestWordScore;
  }

  // Boost recent entries
  if (item.type === "entry") {
    if (isRecent(item.updatedAt || item.createdAt, 7)) {
      totalScore *= 1.5;
    }
    if (item.streakEligible) {
      totalScore *= 1.2;
    }
  }

  return { score: totalScore, matches };
}

// ---------------------------------------------------------------------------
// Main search function
// ---------------------------------------------------------------------------

export function search(
  query: string,
  index: SearchableItem[],
  filters?: SearchFilters,
  limit = 20,
): SearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const queryWords = normalize(trimmed).split(/\s+/).filter(Boolean);
  if (queryWords.length === 0) return [];

  // Apply type and category filters
  let items = index;
  if (filters?.types && filters.types.length > 0) {
    items = items.filter((item) => filters.types!.includes(item.type));
  }
  if (filters?.categories && filters.categories.length > 0) {
    items = items.filter(
      (item) => item.type !== "entry" || filters.categories!.includes(item.category),
    );
  }
  if (filters?.statuses && filters.statuses.length > 0) {
    items = items.filter(
      (item) => item.type !== "entry" || filters.statuses!.includes(item.status),
    );
  }

  const results: SearchResult[] = [];
  for (const item of items) {
    const { score, matches } = scoreItem(item, queryWords);
    if (score > 0) {
      results.push({ item, score, matches });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
