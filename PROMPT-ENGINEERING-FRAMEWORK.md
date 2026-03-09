# TSEDA PROMPT ENGINEERING FRAMEWORK v1.0
## The Standard Operating Procedure for Every Claude Code Prompt

---

## HOW TO USE THIS DOCUMENT

Before generating ANY prompt for Claude Code:
1. Read the relevant sections of this framework
2. Apply every applicable checkpoint
3. Ask the user questions if ANYTHING is unclear
4. Generate the prompt following the structure below
5. Validate the prompt against the quality checklist before delivering

---

## SECTION 1 — PROMPT STRUCTURE (mandatory for every prompt)

Every prompt MUST follow this skeleton:

```
## Task Type
[BUG_FIX | FEATURE | REFACTOR | STYLE | CLEANUP | AUDIT]

## Priority
[CRITICAL | HIGH | MEDIUM | LOW]

## Context
[Why this change is needed. Reference previous decisions, conversations, specs.]

## Read First
[List EXACT files to read before making changes. Order matters.]

## The Problem / The Feature
[Clear description. Include evidence: error messages, data dumps, screenshots.]

## The Fix / The Implementation
[Step-by-step. Code snippets where possible. No ambiguity.]

## Associations & Side Effects
[What else this change touches. Ripple effects. Things to verify.]

## Scope
[MODIFY: files to change]
[CREATE: new files]
[DELETE: files to remove]
[DO NOT MODIFY: files to leave alone]

## Verification
[Exact steps to test. Expected outcomes. Commands to run.]
```

---

## SECTION 2 — THE SEVEN LAWS OF PROMPT ACCURACY

### Law 1: Trace Before You Fix
Never guess what's broken. Always diagnose first by asking the user to run terminal commands. See the ACTUAL data, the ACTUAL code, the ACTUAL error. Then write the fix based on evidence, not assumptions.

**Pattern:**
```
1. Ask user to run diagnostic commands
2. Read the output
3. Identify the exact break (file, line, field, value)
4. Write the fix targeting that exact location
```

### Law 2: One Prompt, One Job
Each prompt should do ONE thing well. If a task has multiple parts, break it into sequential prompts. Large prompts (>200 lines) fail in Claude Code — they get partially applied or silently skip sections.

**Size limits:**
- Small fix: 20-50 lines (best success rate)
- Medium feature: 50-150 lines (good success rate)
- Large refactor: 150-300 lines (risky — consider splitting)
- Mega prompt: 300+ lines (will likely fail — MUST split)

### Law 3: Name Every File
Never say "find the relevant file" — Claude Code may find the wrong one or skip it. Always specify exact file paths discovered through terminal diagnostics.

**Bad:** "Find where the button is rendered and fix it"
**Good:** "In components/entry/EntryActionsBar.tsx, line 94, inside the isViewMode block..."

### Law 4: Show the Current Code
When asking Claude Code to change specific code, include what the code currently looks like (from grep/cat output). This prevents Claude Code from guessing and changing the wrong thing.

**Pattern:**
```
Find this line in components/entry/EntryActionsBar.tsx:

  const canFinalise = isGenerated && editable && allFieldsComplete;

Change to:

  const canFinalise = isGenerated && editable && allFieldsComplete && pdfFresh;
```

### Law 5: Protect the Boundaries
Always specify what NOT to change. Claude Code tends to "helpfully" refactor nearby code.

**Pattern:**
```
## Scope
- MODIFY: lib/entries/internal/engine.ts (only the finalizeEntry function)
- DO NOT MODIFY: lib/streakProgress.ts, lib/entries/workflow.ts, any API routes
```

### Law 6: Verify or It Didn't Happen
Every prompt must end with verification steps. If you can't verify it, the fix isn't complete.

**Pattern:**
```
## Verification
1. npm run build — must pass
2. Delete test entry: rm .data/users/senarch@tce.edu/fdp-attended.json
3. npm run dev
4. Create entry → fill fields → Generate PDF
5. Check data: cat .data/users/senarch@tce.edu/fdp-attended.json | grep pdfGenerated
6. Expected: pdfGenerated: true
7. Dashboard shows Activated: 1
```

### Law 7: Reference the Spec
When the prompt touches streaks, statuses, timers, or workflow — always include the relevant rule from our established specs. Don't assume Claude Code remembers previous prompts.

**Pattern:**
```
## Context
Per the STREAK-FINAL-SPECIFICATION:
- CHECKPOINT 1: Generate PDF → gate to Activated
- CHECKPOINT 2: Finalise → gate to Wins
- End date exception: changed to past on save → immediate removal
```

---

## SECTION 3 — DIAGNOSTIC COMMANDS LIBRARY

Before writing any prompt, gather evidence. Use these commands:

### Find where something is defined:
```bash
grep -rn "functionName\|variableName" lib/ app/ components/ hooks/ --include="*.ts" --include="*.tsx" | head -15
```

### See how a function works:
```bash
grep -A 20 "function functionName" path/to/file.ts
```

### See a specific line range:
```bash
sed -n '100,130p' path/to/file.ts
```

### Check entry data:
```bash
cat .data/users/senarch@tce.edu/fdp-attended.json | python3 -c "
import sys,json
d=json.load(sys.stdin)
for eid,e in d['byId'].items():
    for k in ['key1','key2','key3']:
        print(f'{k}: {e.get(k, \"MISSING\")}')"
```

### Check if a field exists in API response:
```bash
grep -n "fieldName" app/api/me/fdp-attended/route.ts | head -10
```

### Check imports and connections:
```bash
grep -rn "import.*from.*moduleName" app/ lib/ components/ | head -10
```

### Check file sizes:
```bash
wc -l path/to/file1.ts path/to/file2.ts
```

### Full function extraction:
```bash
grep -B2 -A40 "function functionName" path/to/file.ts | head -45
```

---

## SECTION 4 — ASSOCIATION MAPPING

Before finalizing any prompt, trace ALL associations. Every change ripples.

### The Association Checklist:

**If changing an API route response shape:**
- [ ] Does the client-side type match?
- [ ] Does the client component read the new/changed fields?
- [ ] Does the dashboard summary read these fields?
- [ ] Do other API routes return the same shape?
- [ ] Are there 5 category routes that need the same change?

**If changing entry status logic:**
- [ ] Does workflow.ts handle the status?
- [ ] Does the entry card grouping (entryCategorization.ts) handle it?
- [ ] Does the action bar (EntryActionsBar.tsx) render correct buttons?
- [ ] Does the entry card (CategoryEntryRecordCard.tsx) render correct buttons?
- [ ] Does the streak computation handle it?
- [ ] Does the dashboard summary handle it?
- [ ] Do ALL 5 adapters handle it?

**If changing streak logic:**
- [ ] Does streakProgress.ts isEntryActivated handle it?
- [ ] Does streakProgress.ts isEntryWon handle it?
- [ ] Does the dashboard getDashboardSummary compute it?
- [ ] Does postSave.ts normalize it?
- [ ] Do the API routes return the fields?
- [ ] Does the client form state include the fields?

**If changing button behavior:**
- [ ] Which component renders the button? (exact file and line)
- [ ] What props control enabled/disabled?
- [ ] Where do those props come from? (trace the chain)
- [ ] Is the same button on the entry card AND the editor? (both need fixing)
- [ ] Does the server-side validation match the client-side enablement?

**If changing field validation:**
- [ ] Does Generate Entry check this?
- [ ] Does Finalise Now check this?
- [ ] Does the server-side engine check this?
- [ ] Are file uploads excluded from data-field-only checks?
- [ ] Is the check in ONE canonical function or duplicated?

---

## SECTION 5 — THE FIVE CATEGORY ROUTE RULE

This app has 5 category-specific API routes that MUST stay in sync:
1. app/api/me/fdp-attended/route.ts
2. app/api/me/fdp-conducted/route.ts
3. app/api/me/guest-lectures/route.ts
4. app/api/me/case-studies/route.ts
5. app/api/me/workshops/route.ts

And 5 category adapters:
1. components/data-entry/adapters/fdp-attended.tsx
2. components/data-entry/adapters/fdp-conducted.tsx
3. components/data-entry/adapters/guest-lectures.tsx
4. components/data-entry/adapters/case-studies.tsx
5. components/data-entry/adapters/workshops.tsx

**RULE: If a change applies to one, it applies to ALL FIVE.**

Every prompt that touches a route or adapter MUST include:
```
Apply this change to ALL 5 category routes:
- app/api/me/fdp-attended/route.ts
- app/api/me/fdp-conducted/route.ts
- app/api/me/guest-lectures/route.ts
- app/api/me/case-studies/route.ts
- app/api/me/workshops/route.ts
```

Or for adapters:
```
Apply to all 5 adapters:
- components/data-entry/adapters/fdp-attended.tsx
- components/data-entry/adapters/fdp-conducted.tsx
- components/data-entry/adapters/guest-lectures.tsx
- components/data-entry/adapters/case-studies.tsx
- components/data-entry/adapters/workshops.tsx
```

---

## SECTION 6 — CANONICAL FILE MAP

These are the key files and what they own. Reference this when writing prompts.

### Entry Lifecycle (source of truth for status transitions):
- lib/entries/workflow.ts — isEditable, isFinalized, normalizeEntryStatus, computeEditWindowExpiry
- lib/entries/internal/engine.ts — server-side operations: createEntry, updateEntry, finalizeEntry, grantEditAccess, etc.
- lib/entries/lifecycle.ts — public API re-exports from engine.ts
- lib/entries/postSave.ts — normalizeEntryStreakFields (called on every save)

### Streak System (source of truth for streak rules):
- lib/streakProgress.ts — isEntryActivated, isEntryWon, computeCanonicalStreakSnapshot, hasPdfGenerated
- STREAK-FINAL-SPECIFICATION.txt — the human-readable spec

### PDF System:
- lib/pdf/pdfService.ts — generateAndPersistEntryPdf, buildPdfPatch
- lib/pdfSnapshot.ts — hashPrePdfFields, computePdfState, getHashPayload
- lib/entries/generate.ts — client-side generateEntrySnapshot (calls /api/me/entry/generate)

### Dashboard Data Flow:
- lib/dashboard/getDashboardSummary.ts — THE dashboard data function (calls computeCanonicalStreakSnapshot)
- lib/entries/summary.ts — re-exports getDashboardSummary + getDataEntrySummary
- app/(protected)/dashboard/page.tsx — reads from getDashboardSummary

### Entry Grouping:
- lib/entryCategorization.ts — getEntryListGroup (assigns entries to groups: streak_runners, on_the_clock, locked_in, etc.)

### UI Components:
- components/entry/EntryActionsBar.tsx — THE action bar (Generate, Finalise, Save, Cancel buttons)
- components/data-entry/CategoryEntryRecordCard.tsx — entry list card (Edit, Delete, View, Request Action buttons)
- components/data-entry/GroupedEntrySections.tsx — grouped entry list display
- components/data-entry/EditorProgressHeader.tsx — progress bar and streak badge
- components/data-entry/EditorStatusBanner.tsx — finalized/locked status banner

### Hooks:
- hooks/useCategoryEntryPageController.ts — main controller for entry pages
- hooks/useEntryWorkflow.ts — workflow state (coreDirty, lifecycle stages)
- hooks/useEntryEditor.ts — form state, pdfState, dirty tracking
- hooks/useEntryViewMode.ts — view mode detection

### Types:
- lib/types/entry.ts — Entry type with all fields
- lib/entries/types.ts — CategoryKey and other type exports

---

## SECTION 7 — KNOWN ARCHITECTURAL PATTERNS

### Pattern: The 5 Routes Bypass engine.ts
The category API routes save entries DIRECTLY to JSON. They do NOT call engine.ts for most operations. The postSave.ts normalizeEntryStreakFields is called from getDashboardSummary at read-time to backfill missing fields. When writing prompts that need fields set on save, EITHER:
a) Add the logic to postSave.ts (preferred — one place), OR
b) Add to each of the 5 routes (fragile — can miss one)

### Pattern: Client Form State
The entry editor form state comes from the adapter's useEntryEditor hook. After a server action (save, generate, finalise), the server response is spread into the form. If the server doesn't return a field, the form won't have it.

### Pattern: pdfStale Computation
Client-side: computePdfState in lib/pdfSnapshot.ts compares pdfSourceHash with current hash from getHashPayload. Server-side: each route may compute it independently (inconsistently). The hash ONLY includes Stage 1 data fields, NOT file uploads.

### Pattern: View Mode
isViewMode is true when viewEntryId URL param is set. For finalized entries, effectiveViewMode should be forced true. The EntryActionsBar has separate rendering branches for isViewMode true vs false.

---

## SECTION 8 — QUESTION PROTOCOL

Before generating any prompt, ask questions about:

### Ambiguity Questions (MUST ask if unclear):
- "When you say X, do you mean A or B?"
- "Should this apply to all categories or just FDP Attended?"
- "When you say 'disabled', do you mean greyed out (visible but not clickable) or hidden entirely?"

### Edge Case Questions (SHOULD ask for non-trivial changes):
- "What happens if the user does X while Y is in progress?"
- "What if the API call fails — should the button revert or show an error?"
- "What about entries created before this change — do they need migration?"

### Improvement Questions (CAN ask to enhance the requirement):
- "Should I also add a loading spinner while this processes?"
- "Should this change also apply to the entry list card, not just the editor?"
- "Industry practice is to do X — would you like that instead?"

### Confirmation Questions (MUST ask for destructive or irreversible changes):
- "This will permanently change how X works — are you sure?"
- "This removes feature Y — do you want it removed or just hidden?"
- "This affects all 5 categories — should I do them all?"

---

## SECTION 9 — PROMPT QUALITY CHECKLIST

Before delivering ANY prompt, verify:

- [ ] **Task type** is specified (BUG_FIX, FEATURE, etc.)
- [ ] **Priority** is specified
- [ ] **Context** references previous decisions/specs where relevant
- [ ] **Read First** lists exact file paths
- [ ] **The fix** is specific — not vague ("find and fix" is BAD; "in file X, line Y, change Z" is GOOD)
- [ ] **All 5 routes** are mentioned if the change touches routes
- [ ] **All 5 adapters** are mentioned if the change touches adapters
- [ ] **Side effects** are identified (what else does this change touch?)
- [ ] **DO NOT MODIFY** section protects unrelated files
- [ ] **Verification** has concrete steps (not "test it works")
- [ ] **Prompt is under 200 lines** (split if larger)
- [ ] **No assumptions** — every claim is backed by diagnostic evidence
- [ ] **Server AND client** are both addressed if the change spans both
- [ ] **Types are updated** if new fields are added

---

## SECTION 10 — ANTI-PATTERNS (things that cause prompts to fail)

### Anti-Pattern 1: The Mega Prompt
Prompts over 300 lines get partially applied. Claude Code loses context halfway through and skips steps.
**Fix:** Split into 2-3 sequential prompts.

### Anti-Pattern 2: "Fix Everything"
Vague instructions like "audit the entire codebase and fix all issues" produce surface-level changes that miss the real bugs.
**Fix:** Diagnose first, then target specific files and lines.

### Anti-Pattern 3: Assuming Claude Code Remembers
Each Claude Code session has no memory of previous sessions. It doesn't know your specs, your decisions, or your architecture.
**Fix:** Include relevant rules/specs directly in the prompt.

### Anti-Pattern 4: Fixing Symptoms, Not Causes
Adding pdfGenerated=true in one route doesn't fix the root cause (routes bypass engine.ts). The bug will recur.
**Fix:** Always ask "WHY is this broken?" and fix the root cause.

### Anti-Pattern 5: No Verification
If the prompt doesn't specify how to verify, you won't know if it worked.
**Fix:** Every prompt ends with concrete verification steps.

### Anti-Pattern 6: Changing Shared Functions Without Tracing Callers
Modifying a function in workflow.ts affects every file that imports it.
**Fix:** Always grep for all callers before changing shared functions.

---

## SECTION 11 — REFERENCE SPECS (include relevant sections in prompts)

### Entry Statuses:
DRAFT, GENERATED, EDIT_REQUESTED, DELETE_REQUESTED, EDIT_GRANTED, ARCHIVED

### Streak Rules:
- CHECKPOINT 1: Generate PDF → Activated (end date must be future)
- CHECKPOINT 2: Finalise → Win (eligible + mandatory fields + valid PDF + finalized)
- End date → past on save: immediate Activated removal (recoverable)
- Request on Win: permanent removal
- Archive/restore: permanent removal
- Field edits (except end date): no effect on streaks

### Button Rules:
- Generate Entry: visible when no PDF or PDF stale from Stage 1 edits. Hidden when fresh PDF exists.
- Finalise Now: hidden when no PDF. Visible when PDF exists and not stale. Enabled when all fields (including uploads) complete.
- Save / Save & Close: always enabled when form is dirty. No mandatory field validation.
- Cancel: always enabled.

### Stage 1 vs Stage 2:
- Stage 1 (data fields): programName, startDate, endDate, organisingBody, etc. — required for Generate. Changes make PDF stale.
- Stage 2 (file uploads): permissionLetter, completionCertificate — required for Finalise only. Changes do NOT make PDF stale.

### Timer:
- Non-streak: 3 days from committedAtISO
- Streak: endDate + 8 days
- Timer never resets once started
- No PDF at expiry → auto-archive

### Permanently Locked:
- After second finalization (edit granted → finalised again): permanentlyLocked = true
- Only View button, no Request Action
