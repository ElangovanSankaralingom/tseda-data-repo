# Two-Stage Field Model — TSEDA

## Core Rule

Every entry has two independent sets of fields. They do NOT affect each other.

---

## Stage 1 — Primary Fields (Before Generate)

**What:** Data fields — program name, dates, organising body, academic year, semester, support amount, etc.

**When visible:** Always, from entry creation.

**Purpose:** These fields are the content of the PDF document.

**Rules:**
- Changing ANY stage 1 field after PDF generation → marks PDF as "Document outdated"
- ALL required stage 1 fields must be filled before Generate Entry is enabled
- Stage 1 fields feed into `pdfSourceHash` — the hash that determines staleness
- After finalization (edit window expired), stage 1 fields are locked

---

## Stage 2 — Secondary Fields (After Generate)

**What:** File uploads — permission letter, completion certificate, photos, supporting documents.

**When visible:** Only AFTER Generate Entry succeeds (PDF exists).

**Purpose:** Supporting documents uploaded alongside the entry. They are NOT part of the PDF.

**Rules:**
- Uploading or deleting a stage 2 file must NEVER trigger "Document outdated"
- Stage 2 fields are excluded from `pdfSourceHash` computation
- Stage 2 fields do NOT affect Generate Entry button state
- Stage 2 fields do NOT affect PDF preview/download availability
- Stage 2 fields have their own completion tracking (for streak "win" calculation)
- Stage 2 fields can be modified even after stage 1 is locked (finalized)

---

## Hash Rule

```
pdfSourceHash = hash(stage 1 fields ONLY)
pdfStale = (currentHash !== pdfSourceHash)
```

Stage 2 fields are ALWAYS excluded from hash computation.

If the hash changes → "Document outdated" → user must regenerate.
If only stage 2 fields change → hash stays the same → NO staleness.

---

## Button States

| State | Save | Generate | Preview/Download | Done/Finalise |
|-------|------|----------|-----------------|---------------|
| Empty form | ❌ | ❌ | ❌ | ❌ |
| Stage 1 partially filled | ✅ | ❌ | ❌ | ❌ |
| Stage 1 complete, no PDF | ✅ | ✅ | ❌ | ❌ |
| PDF generated, stage 2 empty | ✅ | ❌ | ✅ | ✅ |
| PDF generated, stage 2 uploading | ✅ | ❌ | ✅ | ❌ (busy) |
| PDF generated, stage 2 complete | ✅ | ❌ | ✅ | ✅ |
| Stage 1 changed after generate | ✅ | ✅ | ❌ | ❌ |
| Stage 2 changed after generate | ✅ | ❌ | ✅ | ✅ |

Key: Stage 2 changes NEVER affect Generate, Preview, or Download buttons.

---

## Streak Rules

- **Activated:** Stage 1 complete + PDF generated + entry is streak-eligible
- **Win:** Activated + ALL stage 2 fields filled (all required uploads present)
- Stage 2 completion determines win, but does NOT affect PDF or stage 1

---

## Schema Annotation

Each field in `data/schemas/*.ts` has a `stage` property:

```typescript
{ key: "programName", label: "Program Name", kind: "string", stage: 1 }
{ key: "permissionLetter", label: "Permission Letter", kind: "object", upload: true, stage: 2 }
```

- `stage: 1` → included in hash, required before generate
- `stage: 2` → excluded from hash, visible after generate

---

## Implementation Files

- `lib/pdfSnapshot.ts` — `getHashPayload()` excludes stage 2 fields via `getStage2FieldKeys()`
- `data/schemas/*.ts` — field definitions with `stage: 1` or `stage: 2`
- `hooks/useEntryEditor.ts` — client-side hash + pdfState computation
- `components/data-entry/EntryDocumentSection.tsx` — shows "Document outdated" when `pdfStale`
- `lib/streakProgress.ts` — streak win checks stage 2 completion
