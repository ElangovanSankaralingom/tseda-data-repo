#!/bin/bash
# Verify all registered categories are properly wired.
# Run from the project root: ./scripts/verify-categories.sh

set -euo pipefail

PASS=0
FAIL=0

pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ MISSING: $1"; FAIL=$((FAIL + 1)); }

# Extract registered category slugs from CATEGORY_SLUGS array in categoryRegistry.ts
CATEGORIES=$(sed -n '/^export const CATEGORY_SLUGS/,/\] as const/p' data/categoryRegistry.ts \
  | grep -oE '"[a-z][-a-z]+"' | sed 's/"//g')

if [ -z "$CATEGORIES" ]; then
  echo "Could not extract categories from data/categoryRegistry.ts"
  exit 1
fi

echo "=== Registered categories ==="
for cat in $CATEGORIES; do
  echo "  $cat"
done

echo ""
echo "=== Schema files ==="
for cat in $CATEGORIES; do
  if [ -f "data/schemas/${cat}.ts" ]; then
    pass "$cat"
  else
    fail "data/schemas/${cat}.ts"
  fi
done

echo ""
echo "=== API routes ==="
for cat in $CATEGORIES; do
  if [ -f "app/api/me/${cat}/route.ts" ]; then
    pass "$cat"
  else
    fail "app/api/me/${cat}/route.ts"
  fi
done

echo ""
echo "=== Adapters ==="
for cat in $CATEGORIES; do
  if [ -f "components/data-entry/adapters/${cat}.tsx" ]; then
    pass "$cat"
  else
    fail "components/data-entry/adapters/${cat}.tsx"
  fi
done

echo ""
echo "=== Pages ==="
for cat in $CATEGORIES; do
  PAGE_DIR="app/(protected)/data-entry/${cat}"
  if [ -f "${PAGE_DIR}/page.tsx" ] && [ -f "${PAGE_DIR}/[id]/page.tsx" ] && [ -f "${PAGE_DIR}/new/page.tsx" ]; then
    pass "$cat (list + [id] + new)"
  else
    missing=""
    [ ! -f "${PAGE_DIR}/page.tsx" ] && missing="${missing} page.tsx"
    [ ! -f "${PAGE_DIR}/[id]/page.tsx" ] && missing="${missing} [id]/page.tsx"
    [ ! -f "${PAGE_DIR}/new/page.tsx" ] && missing="${missing} new/page.tsx"
    fail "${cat} — missing:${missing}"
  fi
done

echo ""
echo "=== Schema validation is schema-driven ==="
ADAPTER_COUNT=$(grep -rl "validateEntryFields\|schemaValidator" components/data-entry/adapters/*.tsx 2>/dev/null | wc -l | tr -d ' ')
echo "  ${ADAPTER_COUNT} adapter(s) use schema-driven validation"

echo ""
echo "=== Stage annotations ==="
STAGED=$(grep -l "stage:" data/schemas/*.ts 2>/dev/null | grep -v types.ts | grep -v common.ts | wc -l | tr -d ' ')
TOTAL=$(ls data/schemas/*.ts 2>/dev/null | grep -v types.ts | grep -v common.ts | wc -l | tr -d ' ')
echo "  ${STAGED}/${TOTAL} schemas use stage annotations"

echo ""
echo "=== Summary ==="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Some checks failed. Fix the missing files above."
  exit 1
fi
