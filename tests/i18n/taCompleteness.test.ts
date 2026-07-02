import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// Guard: the Tamil dictionary must never contain untranslated English
// placeholders. The TypeScript type check guarantees key parity with en.ts,
// but it cannot catch English VALUES left behind with a TODO marker — this
// test fails the suite loudly instead of letting the silent en-fallback
// mask incomplete translations (the exact gap the 2026-07 audit found).
test("ta.ts contains no 'TODO: translate' placeholders", () => {
  const source = readFileSync(
    path.join(process.cwd(), "lib", "i18n", "ta.ts"),
    "utf8",
  );
  const matches = source.match(/TODO: translate/g) ?? [];
  assert.equal(
    matches.length,
    0,
    `Found ${matches.length} untranslated TODO marker(s) in lib/i18n/ta.ts — translate the values instead of leaving English placeholders.`,
  );
});
