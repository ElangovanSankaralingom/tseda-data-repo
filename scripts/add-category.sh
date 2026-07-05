#!/bin/bash
# Usage: ./scripts/add-category.sh <category-slug> "<Display Label>"
# Example: ./scripts/add-category.sh journal-papers "Journal Papers"
#
# Creates convention-clean skeleton files for a new category:
#   - data/schemas/<slug>.ts                      (schema — two-stage field model)
#   - app/api/me/<slug>/route.ts                  (thin API route wrapper)
#   - components/data-entry/adapters/<slug>.tsx   (adapter skeleton)
#
# Pages are handled by the dynamic [category] route — no per-category pages needed.
#
# IMPORTANT ORDER: register the slug in data/categoryRegistry.ts FIRST —
# until then, tsc fails on the new schema/adapter (by design: the compiler
# forces the registration step, no `as any` escape hatches).
#
# The generated files follow every CLAUDE.md convention: two-stage fields,
# multi-file uploads (FileMeta[]), sponsored pattern, `collaborates` hint,
# i18n via t()/fieldLabel(), theme tokens only. tests/schemas enforces the
# structural invariants — the suite fails loudly if the pattern is violated.

set -euo pipefail

SLUG="${1:-}"
LABEL="${2:-}"

if [ -z "$SLUG" ] || [ -z "$LABEL" ]; then
  echo "Usage: ./scripts/add-category.sh <slug> \"<Label>\""
  echo "Example: ./scripts/add-category.sh journal-papers \"Journal Papers\""
  exit 1
fi

# Derive identifiers
# slug: journal-papers → camelCase: journalPapers → PascalCase: JournalPapers
CAMEL=$(echo "$SLUG" | awk -F- '{out=$1; for(i=2;i<=NF;i++){out=out toupper(substr($i,1,1)) substr($i,2)} print out}')
PASCAL=$(echo "$CAMEL" | awk '{print toupper(substr($0,1,1)) substr($0,2)}')

echo "Creating category: $SLUG ($LABEL)"
echo "  camelCase: $CAMEL"
echo "  PascalCase: $PASCAL"
echo ""

# Guard: don't overwrite existing files
if [ -f "data/schemas/${SLUG}.ts" ]; then
  echo "ERROR: data/schemas/${SLUG}.ts already exists."
  exit 1
fi

# ── 1. Schema ──────────────────────────────────────────────────────────────

cat > "data/schemas/${SLUG}.ts" << SCHEMA
import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";
import { DEFAULT_WORKFLOW_CONFIG, type WorkflowConfig } from "@/lib/workflow/workflowConfig";

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true, exportable: false },
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "semesterType", label: "Semester Type", kind: "string", stage: 1 },
  { key: "level", label: "Level", kind: "string", stage: 1, enumValues: ["National", "International"] },
  { key: "mode", label: "Mode", kind: "string", stage: 1, enumValues: ["Online", "Offline"] },
  { key: "startDate", label: "Start Date", kind: "date" },
  { key: "endDate", label: "End Date", kind: "date" },
  // TODO: category-specific stage-1 data fields go here.
  // A faculty-row field whose listed colleagues should receive their OWN
  // copy of the entry on generate (own PDF/timer/streak) is marked:
  // { key: "coCoordinators", label: "Co-Coordinators", kind: "array", required: false, collaborates: true },
  { key: "sponsored", label: "Sponsored", kind: "string", required: false, enumValues: ["Yes", "No"] },
  { key: "fundingAgency", label: "Funding Agency", kind: "string", required: false },
  { key: "fundingAmount", label: "Funding Amount", kind: "number", required: false, format: "currency" },
  // Stage 2 — uploads. ALWAYS kind: "array" (multi-file FileMeta[]), NEVER
  // single-object uploads. Stage 2 never affects the PDF hash.
  { key: "permissionLetter", label: "Permission Letter", kind: "array", upload: true, stage: 2 },
  // TODO: more upload slots here.
  { key: "pdfMeta", label: "PDF Metadata", kind: "object", exportable: false },
  { key: "streak", label: "Streak", kind: "object", exportable: false },
] as const;

export const workflow: WorkflowConfig = { ...DEFAULT_WORKFLOW_CONFIG };

export const ${CAMEL}Schema: EntrySchema = {
  // Register "${SLUG}" in data/categoryRegistry.ts FIRST — tsc fails here
  // until the slug exists in the CategoryKey union (this is intentional).
  category: "${SLUG}",
  fields,
  immutableWhenPending: [
    "academicYear", "semesterType", "level", "mode",
    "startDate", "endDate",
    // Every stage-1 field (INCLUDING collaborates fields) belongs here so
    // nothing changes after generate without an edit grant.
    "sponsored", "fundingAgency", "fundingAmount",
  ],
  requiredForCommit: [
    "academicYear", "semesterType", "level", "mode",
    "startDate", "endDate",
    // TODO: category-specific required fields (NOT optional ones).
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
SCHEMA

echo "  ✓ data/schemas/${SLUG}.ts"

# ── 2. API route ───────────────────────────────────────────────────────────

mkdir -p "app/api/me/${SLUG}"

cat > "app/api/me/${SLUG}/route.ts" << 'ROUTE'
import { demoAware } from "@/lib/demo/demoAware";
import { type NextRequest } from "next/server";
import {
  handleCategoryGet,
  handleCategoryPost,
  handleCategoryPatch,
  handleCategoryDelete,
} from "@/lib/api/categoryRouteHandler";
ROUTE

cat >> "app/api/me/${SLUG}/route.ts" << ROUTE

const CATEGORY = "${SLUG}" as const;

async function GETHandler(req: NextRequest) {
  return handleCategoryGet(req, CATEGORY);
}

async function POSTHandler(req: NextRequest) {
  return handleCategoryPost(req, CATEGORY);
}

async function PATCHHandler(req: NextRequest) {
  return handleCategoryPatch(req, CATEGORY);
}

async function DELETEHandler(req: NextRequest) {
  return handleCategoryDelete(req, CATEGORY);
}

// Demo-mode universe wrapper — every handler runs in the caller's universe
// (tests/demo/routeGuard.test.ts enforces this on every route).
export const GET = demoAware(GETHandler);
export const POST = demoAware(POSTHandler);
export const PATCH = demoAware(PATCHHandler);
export const DELETE = demoAware(DELETEHandler);
ROUTE

echo "  ✓ app/api/me/${SLUG}/route.ts"

# ── 3. Adapter ─────────────────────────────────────────────────────────────

cat > "components/data-entry/adapters/${SLUG}.tsx" << ADAPTER
"use client";

import { useTranslation } from "@/lib/i18n/useTranslation";
import { uuid } from "@/lib/utils/idHelpers";
import BaseEntryAdapter from "@/components/data-entry/adapters/BaseEntryAdapter";
import type { CategoryAdapterPageProps } from "@/components/data-entry/adapters/types";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

// Follow an existing adapter (components/data-entry/adapters/workshops.tsx)
// for the full pattern: FormFieldGroup sections, PillSelect/SelectDropdown/
// DateField controls, UploadFieldMulti for stage-2 slots, FacultyPickerRows
// for collaborates fields, sponsored conditional, hydrateEntry helpers.
//
// CONVENTIONS (enforced by lint + tests — do not deviate):
// - ZERO hardcoded user-facing strings: t('key') / fieldLabel('fieldKey')
//   only, with keys added to BOTH lib/i18n/en.ts and lib/i18n/ta.ts.
// - Colors via CSS variable tokens only (lib/theme/themeTokens.ts) — the
//   theme guard hard-fails raw hex / white-alpha / Tailwind palette drift.
// - No \`any\`, no console.log. Inputs use value={field || ""}.

type ${PASCAL}Entry = Record<string, unknown> & {
  id: string;
  academicYear: string;
  startDate: string;
  endDate: string;
  // TODO: category-specific fields (see adapterTypes.ts for the shape
  // pattern, including sharedEntryId/sourceEmail/sharedRole provenance).
};

function emptyForm(): ${PASCAL}Entry {
  return {
    id: uuid(),
    requestEditStatus: "none",
    requestEditRequestedAtISO: null,
    requestEditMessage: "",
    academicYear: "",
    semesterType: "",
    startDate: "",
    endDate: "",
    // TODO: defaults for category-specific fields.
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  } as ${PASCAL}Entry;
}

function validateFields(form: ${PASCAL}Entry): Record<string, string> {
  return validateEntryFields("${SLUG}", form as unknown as Record<string, unknown>);
}

export function ${PASCAL}Page(props: CategoryAdapterPageProps = {}) {
  const { t } = useTranslation();
  return (
    <BaseEntryAdapter<${PASCAL}Entry>
      {...props}
      category="${SLUG}"
      emptyForm={emptyForm}
      validateFields={validateFields}
      renderFormFields={() => (
        <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          {t('entry.formComingSoon')}
        </div>
      )}
      buildListEntryTitle={(entry) => String(entry.id)}
      title={t('entry.${CAMEL}PageTitle')}
      subtitle={t('entry.${CAMEL}PageSubtitle')}
      formTitle={t('entry.${CAMEL}FormTitle')}
      formSubtitle={t('entry.${CAMEL}FormSubtitle')}
      deleteDescription={t('entry.${CAMEL}DeleteDesc')}
    />
  );
}

export default ${PASCAL}Page;
ADAPTER

echo "  ✓ components/data-entry/adapters/${SLUG}.tsx"

# ── Done ───────────────────────────────────────────────────────────────────

echo ""
echo "Scaffolded: $SLUG"
echo ""
echo "MANUAL STEPS REMAINING (in this order):"
echo "  1. Register in data/categoryRegistry.ts FIRST (tsc fails until then):"
echo "     - Add '${SLUG}' to the slug union / CATEGORY list"
echo "     - Import ${CAMEL}Schema + add the registry entry (label, icon,"
echo "       color, schema, entryTitleField)"
echo "  2. Edit data/schemas/${SLUG}.ts — real fields; keep the two-stage"
echo "     model; mark faculty-row fan-out fields with collaborates: true"
echo "  3. Router: components/data-entry/CategoryPageRouter.tsx —"
echo "     lazy import { ${PASCAL}Page } + map '${SLUG}'"
echo "  4. i18n: add every new key to BOTH lib/i18n/en.ts AND lib/i18n/ta.ts"
echo "     (the ta-completeness test fails on TODO placeholders)"
echo "  5. Flesh out the adapter from an existing one (workshops.tsx)"
echo "  6. Gates (ALL must pass before commit):"
echo "     npm run lint && npx tsc --noEmit && npm test && npm run build"
echo "     (tests/schemas/schemaInvariants.test.ts checks your schema shape)"
echo "  7. Manual test: create → fill → generate → upload → finalise"
