import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

/**
 * WCAG 2.1 AA CONTRAST GUARD (2026-07 accessibility audit).
 *
 * The Pulse chips, streak tiles, beta pills and hero labels render palette
 * and status fg tokens on their own tinted bg tokens ("accent-on-accent").
 * The 2026-07 audit measured light mode at 1.80:1 for the gold chip — this
 * guard recomputes REAL ratios from themeTokens.ts on every test run so a
 * token edit can never quietly sink below AA again.
 *
 * Rule: every fg-on-own-bg pair must be >= 4.5:1 (chip text is 10-13px),
 * in BOTH light and dark, with the tinted bg composited over the card.
 */

const REQUIRED = 4.5;
const PALETTES = ["violet", "orange", "indigo", "yellow", "emerald", "amber", "cyan", "rose", "blue", "pink", "purple"];
const STATUSES = ["success", "warning", "error", "info"];

type RGBA = [number, number, number, number];

function extractBlock(source: string, name: string): Record<string, string> {
  const match = source.match(new RegExp(`const ${name}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`));
  assert.ok(match, `${name} block found`);
  return Object.fromEntries(
    [...match![1].matchAll(/"(--color-[a-z-]+)":\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]),
  );
}

function parse(color: string): RGBA | null {
  const c = color.trim();
  if (c.startsWith("#")) {
    const hex = c.slice(1);
    const h = hex.length === 3 ? [...hex].map((x) => x + x).join("") : hex;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
}

function blend(fg: RGBA, bg: RGBA): RGBA {
  const a = fg[3];
  return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
}

function luminance(c: RGBA): number {
  const f = (v: number) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}

function ratio(a: RGBA, b: RGBA): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

test("accent-on-accent token pairs hold WCAG AA (4.5:1) in both modes", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "lib/theme/themeTokens.ts"), "utf8");
  const failures: string[] = [];

  for (const blockName of ["LIGHT_BASE", "DARK_BASE"]) {
    const tokens = extractBlock(source, blockName);
    const body = parse(tokens["--color-body-bg"] ?? "#fff")!;
    let card = parse(tokens["--color-card-bg"] ?? "#fff")!;
    if (card[3] < 1) card = blend(card, body);

    const check = (label: string, fgKey: string, bgKey: string) => {
      const fgRaw = tokens[fgKey];
      const bgRaw = tokens[bgKey];
      if (!fgRaw || !bgRaw) return; // token not present in this base — skip
      const fg = parse(fgRaw);
      const bg = parse(bgRaw);
      if (!fg || !bg) return; // var()-aliased tokens can't be computed statically
      const composite = blend(bg, card);
      const r = ratio(blend(fg, composite), composite);
      if (r < REQUIRED) failures.push(`${blockName} ${label}: ${r.toFixed(2)}:1`);
    };

    for (const p of PALETTES) check(`palette-${p}`, `--color-palette-${p}-fg`, `--color-palette-${p}-bg`);
    for (const s of STATUSES) check(`status-${s}`, `--color-status-${s}`, `--color-status-${s}-bg`);

    // Hero band labels: on-accent-muted on both band stops.
    for (const stop of ["--color-band-from", "--color-band-to"]) {
      const band = parse(tokens[stop] ?? "");
      const muted = parse(tokens["--color-text-on-accent-muted"] ?? "");
      if (!band || !muted) continue;
      const r = ratio(blend(muted, band), band);
      if (r < REQUIRED) failures.push(`${blockName} on-accent-muted on ${stop}: ${r.toFixed(2)}:1`);
    }
  }

  assert.deepEqual(failures, [], `contrast regressions:\n${failures.join("\n")}`);
});
