import "server-only";

/**
 * Hand-typed faculty names → registry emails.
 *
 * The workbook's author/faculty cells are free text: "Dr. E. Sankaralingom",
 * "Elangovan S", "Priya R & external co-author", multiple names in one cell.
 * Entries are keyed by email, so resolution quality decides import quality.
 *
 * Design: score every registry record against each name token-wise —
 * full-token matches, initial↔token matches ("e." ↔ "elangovan"), and a
 * small edit-distance tolerance for typos. Thresholds split outcomes into
 * resolved / suggested (report shows the candidate, human confirms) /
 * unresolved (external author, or nobody close). NEVER auto-resolve a
 * below-threshold guess — a wrong owner is worse than a skipped row.
 */

export type RegistryFaculty = { email: string; name: string };

export type NameResolution =
  | { kind: "resolved"; email: string; name: string; score: number }
  | { kind: "suggested"; email: string; name: string; score: number }
  | { kind: "unresolved"; score: number };

const TITLES = /^(dr|prof|professor|ar|er|mr|mrs|ms|smt|shri|thiru)\.?$/;

/** "Dr. E. Sankaralingom" → ["e", "sankaralingom"] (titles stripped). */
export function nameTokens(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[.,()]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t && !TITLES.test(t));
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

function tokenMatch(a: string, b: string): number {
  if (a === b) return 1;
  // Initial ↔ full token ("e" vs "elangovan").
  if (a.length === 1 && b.startsWith(a)) return 0.72;
  if (b.length === 1 && a.startsWith(b)) return 0.72;
  // One is a prefix of the other ("sankar" vs "sankaralingom") — common with
  // truncated hand entry. Require length ≥ 4 to avoid noise.
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 4 && long.startsWith(short)) return 0.85;
  // Typo tolerance scaled by length.
  if (short.length >= 5) {
    const d = editDistance(a, b);
    if (d === 1) return 0.8;
    if (d === 2 && short.length >= 7) return 0.65;
  }
  return 0;
}

/**
 * Similarity of a workbook name to a registry name in [0,1]: best one-to-one
 * token assignment (greedy), normalized by the LARGER token count so
 * "Priya" alone can't fully claim "Priya Ramachandran".
 */
export function nameSimilarity(candidate: string, registryName: string): number {
  const a = nameTokens(candidate);
  const b = nameTokens(registryName);
  if (!a.length || !b.length) return 0;
  const used = new Set<number>();
  let total = 0;
  for (const ta of a) {
    let best = 0;
    let bestJ = -1;
    b.forEach((tb, j) => {
      if (used.has(j)) return;
      const s = tokenMatch(ta, tb);
      if (s > best) {
        best = s;
        bestJ = j;
      }
    });
    if (bestJ >= 0 && best > 0) {
      used.add(bestJ);
      total += best;
    }
  }
  return total / Math.max(a.length, b.length);
}

const RESOLVE_THRESHOLD = 0.78;
const SUGGEST_THRESHOLD = 0.55;
/** A runner-up this close to the top score makes the match ambiguous. */
const AMBIGUITY_MARGIN = 0.1;

export function resolveName(raw: string, registry: readonly RegistryFaculty[]): NameResolution {
  const text = raw.trim();
  // Emails resolve directly when present anywhere in the cell.
  const emailMatch = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.exec(text);
  if (emailMatch) {
    const hit = registry.find((f) => f.email.toLowerCase() === emailMatch[0].toLowerCase());
    if (hit) return { kind: "resolved", email: hit.email, name: hit.name, score: 1 };
  }
  let best: RegistryFaculty | null = null;
  let bestScore = 0;
  let runnerUp = 0;
  for (const f of registry) {
    const s = nameSimilarity(text, f.name);
    if (s > bestScore) {
      runnerUp = bestScore;
      bestScore = s;
      best = f;
    } else if (s > runnerUp) {
      runnerUp = s;
    }
  }
  if (!best || bestScore < SUGGEST_THRESHOLD) return { kind: "unresolved", score: bestScore };
  const ambiguous = bestScore - runnerUp < AMBIGUITY_MARGIN && runnerUp >= SUGGEST_THRESHOLD;
  if (bestScore >= RESOLVE_THRESHOLD && !ambiguous) {
    return { kind: "resolved", email: best.email, name: best.name, score: bestScore };
  }
  return { kind: "suggested", email: best.email, name: best.name, score: bestScore };
}

/**
 * Split a multi-name cell and resolve each part.
 * Splitters: comma, semicolon, ampersand, "and", slashes, newlines. Commas
 * inside "Surname, F." initials pairs are rare in this workbook; the
 * splitter accepts that risk and the report makes any damage visible.
 */
export function resolveNameList(rawCell: string, registry: readonly RegistryFaculty[]): { raw: string; resolution: NameResolution }[] {
  return rawCell
    .split(/[;,/\n&]|\s+and\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 1)
    .map((part) => ({ raw: part, resolution: resolveName(part, registry) }));
}
