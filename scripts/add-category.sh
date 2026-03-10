#!/bin/bash
# Usage: ./scripts/add-category.sh <category-slug> "<Display Label>"
# Example: ./scripts/add-category.sh journal-papers "Journal Papers"
#
# Creates skeleton files for a new category:
#   - data/schemas/<slug>.ts           (schema)
#   - app/api/me/<slug>/route.ts       (API route)
#   - components/data-entry/adapters/<slug>.tsx  (adapter)
#   - app/(protected)/data-entry/<slug>/page.tsx
#   - app/(protected)/data-entry/<slug>/[id]/page.tsx
#   - app/(protected)/data-entry/<slug>/new/page.tsx
#
# After running, you still need to:
#   1. Edit the schema — add your fields
#   2. Register in data/categoryRegistry.ts
#   3. Flesh out the adapter (form fields, list rendering)
#   4. npm run build

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
# Use awk for portable case conversion (macOS sed doesn't support \U)
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

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true, exportable: false },
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "yearOfStudy", label: "Year of Study", kind: "string" },
  { key: "currentSemester", label: "Current Semester", kind: "number", min: 1, max: 10 },
  { key: "startDate", label: "Start Date", kind: "date" },
  { key: "endDate", label: "End Date", kind: "date" },
  // TODO: add category-specific Stage 1 fields here

  // Stage 2 (uploads — do NOT affect PDF hash)
  // TODO: add upload fields here, e.g.:
  // { key: "supportingDocument", label: "Supporting Document", kind: "object", upload: true, stage: 2 },

  { key: "pdfMeta", label: "PDF Metadata", kind: "object", exportable: false },
  { key: "streak", label: "Streak", kind: "object", exportable: false },
] as const;

export const ${CAMEL}Schema: EntrySchema = {
  category: "${SLUG}" as any, // Update CategorySlug first, then remove 'as any'
  fields,
  immutableWhenPending: [
    "academicYear",
    "yearOfStudy",
    "currentSemester",
    "startDate",
    "endDate",
    // TODO: add category-specific immutable fields
  ],
  requiredForCommit: [
    "academicYear",
    "yearOfStudy",
    "currentSemester",
    "startDate",
    "endDate",
    // TODO: add category-specific required fields
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

export async function GET(req: NextRequest) {
  return handleCategoryGet(req, CATEGORY);
}

export async function POST(req: NextRequest) {
  return handleCategoryPost(req, CATEGORY);
}

export async function PATCH(req: NextRequest) {
  return handleCategoryPatch(req, CATEGORY);
}

export async function DELETE(req: NextRequest) {
  return handleCategoryDelete(req, CATEGORY);
}
ROUTE

echo "  ✓ app/api/me/${SLUG}/route.ts"

# ── 3. Adapter ─────────────────────────────────────────────────────────────

cat > "components/data-entry/adapters/${SLUG}.tsx" << ADAPTER
"use client";

import { uuid, ACADEMIC_YEAR_DROPDOWN_OPTIONS } from "@/components/data-entry/adapters/shared";
import BaseEntryAdapter from "@/components/data-entry/adapters/BaseEntryAdapter";
import type { CategoryAdapterPageProps } from "@/components/data-entry/adapters/types";
import { validateEntryFields } from "@/lib/validation/schemaValidator";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ${PASCAL}Entry = Record<string, unknown> & {
  id: string;
  academicYear: string;
  startDate: string;
  endDate: string;
  // TODO: add category-specific fields
};

function emptyForm(): ${PASCAL}Entry {
  return {
    id: uuid(),
    requestEditStatus: "none",
    requestEditRequestedAtISO: null,
    requestEditMessage: "",
    academicYear: "",
    yearOfStudy: "",
    currentSemester: null,
    startDate: "",
    endDate: "",
    // TODO: add default values for category-specific fields
    pdfMeta: null,
    pdfStale: false,
    pdfSourceHash: "",
    streak: { activatedAtISO: null, dueAtISO: null, completedAtISO: null, windowDays: 5 },
    createdAt: "",
    updatedAt: "",
  } as ${PASCAL}Entry;
}

function validateFields(form: ${PASCAL}Entry): Record<string, string> {
  return validateEntryFields("${SLUG}" as any, form as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export function ${PASCAL}Page(props: CategoryAdapterPageProps = {}) {
  return (
    <BaseEntryAdapter<${PASCAL}Entry>
      {...props}
      category={"${SLUG}" as any}
      emptyForm={emptyForm}
      validateFields={validateFields}
      renderFormFields={() => (
        <div className="text-sm text-muted-foreground">
          TODO: implement form fields for ${LABEL}
        </div>
      )}
      buildListEntryTitle={() => "${LABEL} Entry"}
      title="${LABEL}"
      subtitle="TODO: add subtitle"
      formTitle="${LABEL} Entry"
      formSubtitle="Add the entry details and upload the required documents."
      deleteDescription="This permanently deletes this entry and its associated uploaded files."
    />
  );
}

export default ${PASCAL}Page;
ADAPTER

echo "  ✓ components/data-entry/adapters/${SLUG}.tsx"

# ── 4. Pages ───────────────────────────────────────────────────────────────

PAGE_DIR="app/(protected)/data-entry/${SLUG}"
mkdir -p "${PAGE_DIR}/[id]"
mkdir -p "${PAGE_DIR}/new"

# List page
cat > "${PAGE_DIR}/page.tsx" << PAGE
import { ${PASCAL}Page } from "@/components/data-entry/adapters/${SLUG}";

export const dynamic = "force-dynamic";

export { ${PASCAL}Page };

export default function ${PASCAL}PageRoute() {
  return <${PASCAL}Page />;
}
PAGE

# View/edit page (Next.js 16 async params)
cat > "${PAGE_DIR}/[id]/page.tsx" << PAGE
import { ${PASCAL}Page } from "../page";

export const dynamic = "force-dynamic";

type ${PASCAL}ViewPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ${PASCAL}ViewPage({ params }: ${PASCAL}ViewPageProps) {
  const { id } = await params;

  return <${PASCAL}Page editEntryId={id} />;
}
PAGE

# New entry page
cat > "${PAGE_DIR}/new/page.tsx" << PAGE
import { ${PASCAL}Page } from "../page";

export const dynamic = "force-dynamic";

export default function ${PASCAL}NewPage() {
  return <${PASCAL}Page startInNewMode />;
}
PAGE

echo "  ✓ ${PAGE_DIR}/page.tsx"
echo "  ✓ ${PAGE_DIR}/[id]/page.tsx"
echo "  ✓ ${PAGE_DIR}/new/page.tsx"

# ── Done ───────────────────────────────────────────────────────────────────

echo ""
echo "Scaffolded: $SLUG"
echo ""
echo "MANUAL STEPS REMAINING:"
echo "  1. Edit data/schemas/${SLUG}.ts — add your fields"
echo "  2. Register in data/categoryRegistry.ts:"
echo "     - Add '${SLUG}' to CATEGORY_SLUGS array"
echo "     - Add ${CAMEL}Schema import + registry entry"
echo "     - Add '${CAMEL}' to CategorySummaryKey type"
echo "  3. Flesh out components/data-entry/adapters/${SLUG}.tsx"
echo "     - Add form fields to renderFormFields"
echo "     - Add list rendering (buildListEntryTitle, buildListEntrySubtitle, renderListEntryBody)"
echo "  4. npm run build — verify"
echo "  5. Test: create entry, fill fields, generate, finalise"
