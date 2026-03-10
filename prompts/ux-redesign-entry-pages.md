# UX Redesign: Entry Edit Pages — Clarity, Hierarchy, Focus

## Problem
The entry edit/view pages are cluttered. Everything competes for attention — progress bars, status banners, badges, form fields, document section, action buttons, metadata — all at the same visual level. Users don't know what to focus on, what state the entry is in, or what action they should take next.

## Design Principles
1. **One thing at a time**: Show only what's relevant to the current state
2. **Clear hierarchy**: Primary action is obvious, secondary info is subdued
3. **State-aware UI**: The page should look DIFFERENT in each state — not just swap a banner
4. **Progressive disclosure**: Don't dump everything on screen; reveal as the user progresses
5. **Calm interface**: Muted backgrounds, minimal borders, whitespace as a guide

## Page Structure (Top to Bottom)

### Layer 1: Status Strip (compact, always visible)
A single thin strip at the top that tells the user exactly what state this entry is in.
- **DRAFT** (new entry): No strip shown — clean slate
- **GENERATED** (editable): Subtle blue strip: "Entry generated · Edit window closes in 2 days"
- **GENERATED** (finalized/locked): Green strip with lock icon: "Entry finalised · Read-only"
- **EDIT_REQUESTED**: Amber strip: "Edit request pending · Waiting for admin approval" + "Cancel Request" link
- **EDIT_GRANTED**: Purple strip: "Edit access granted · Expires in 3 days"
- **DELETE_REQUESTED**: Red strip: "Delete request pending · Waiting for admin approval" + "Cancel Request" link
- **ARCHIVED**: Gray strip: "This entry has been archived"

Implementation: Replace the current `EditorStatusBanner` component with a new `EntryStatusStrip` component.
- Height: 40px, full width, rounded-lg
- Icon + text + optional action link, all on one line
- No large padding, no multi-line explanations
- Colors: bg-{color}-50 border border-{color}-200 text-{color}-700

### Layer 2: Form Section
The form fields themselves. This is where the user's eye should go.

**Stage 1 fields** (primary):
- Clean white card with subtle border
- Title: just the category name, e.g. "FDP Attended Details"
- Subtitle removed (unnecessary — user already knows what they're doing)
- Fields in a responsive 2-column grid on desktop, 1 column on mobile
- Field labels: text-sm font-medium text-slate-700
- Field inputs: standard height, clear focus states
- Validation errors: inline under each field, text-xs text-red-500

**Pending confirmation lockout**: If `pendingCoreLocked`, overlay the form section with a semi-transparent mask and centered lock icon + message, instead of the current amber banner above the form.

### Layer 3: Document Section (only after generate)
Simplify the 3 states:

**No PDF yet**: Don't show this section at all. The Generate button in the action bar is enough.

**PDF ready**: Compact row — not a full card. Just:
```
✓ Document ready · Generated 2h ago    [Preview] [Download]
```
Single line, green checkmark, buttons inline. No large card, no dashed borders.

**PDF stale**: Same compact row but amber:
```
⚠ Document outdated · Fields changed    [Regenerate ↑]
```

Implementation: Rewrite `EntryDocumentSection` as a compact inline bar, not a full card-in-card layout. Max height: 48px.

### Layer 4: Stage 2 Fields (uploads — only after generate)
- Separated from stage 1 by a subtle divider with label: "Supporting Documents"
- Each upload field as a compact row with file status icon
- No visual competition with stage 1 fields

### Layer 5: Progress Indicator (minimal)
Replace the current `EditorProgressHeader` with a minimal indicator:
- A thin progress bar at the very top of the form card (inside, not a separate component)
- Text below it: "4 of 6 required fields" — no phase pills, no badges, no streak indicators in the progress area
- Streak badge moves to the status strip (Layer 1) if applicable
- Finalise hint ("All fields complete") moves to the action bar area

Implementation: Simplify `EditorProgressHeader`:
- Remove PhasePill components entirely
- Remove streak badge from progress header (move to status strip)
- Remove finalise hint from progress header (move to action bar)
- Keep only: thin progress bar + "X of Y" text
- Make it part of the form card header, not a separate card

### Layer 6: Action Bar (sticky bottom on mobile, inline on desktop)
The action bar at the top should be cleaner:

**New/Edit mode:**
- Left side: Primary action only (Generate Entry OR Finalise Now — never both simultaneously)
  - If no PDF: show "Generate Entry" button (primary, dark)
  - If PDF exists and not stale and canFinalise: show "Finalise Now" button (emerald)
  - If PDF stale: show "Regenerate" button (dark)
  - If pending request: show NO primary action (just the status strip handles it)
- Right side: "Cancel" (ghost) + "Save Draft" (outline) + "Save & Close" (primary)

**View mode (finalized):**
- Left side: "Request Action" dropdown (if not permanently locked and no pending request)
- Right side: "Back" button only

The celebration animation ("🎉 All fields complete") should be a brief toast notification, NOT a persistent banner in the action bar.

### Layer 7: Metadata Footer
Keep the current `EditorMetadataFooter` but make it more subdued:
- Smaller text (text-xs text-slate-400)
- Collapsed by default behind a "Show details" toggle
- Only shows: Entry ID, created date, last updated

## Component Changes

### DELETE: Remove visual clutter
- Remove the `pendingCoreLocked` amber banner paragraph — replace with form overlay
- Remove the "No document generated yet" empty state card with the big icon — just don't show the section
- Remove phase pills (PhasePill component) from EditorProgressHeader
- Remove the streak badge from progress header
- Remove the celebration banner from EntryActionsBar — use a toast instead

### MODIFY: `components/data-entry/EntryDocumentSection.tsx`
Rewrite as a compact single-line bar:
```tsx
// No PDF: return null (don't render anything)
if (!hasPdf) return null;

// PDF stale:
<div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
  <AlertTriangle className="size-4 text-amber-500" />
  <span className="text-sm text-amber-700">Document outdated — fields changed since last generation</span>
</div>

// PDF ready:
<div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5">
  <CheckCircle className="size-4 text-emerald-500" />
  <span className="flex-1 text-sm text-emerald-700">Document ready{generatedAt ? ` · Generated ${formatRelativeTime(generatedAt)}` : ''}</span>
  <button onClick={preview}>Preview</button>
  <a href={downloadUrl}>Download</a>
</div>
```

### MODIFY: `components/data-entry/EditorProgressHeader.tsx`
Simplify to just a progress bar + count text:
```tsx
<div className="mb-4">
  <div className="flex items-center justify-between mb-1.5">
    <span className="text-xs font-medium text-slate-500">
      {progress.completed} of {progress.total} required fields
    </span>
    {streakEligible ? (
      <span className="text-xs font-medium text-amber-600">⚡ Streak Entry</span>
    ) : null}
  </div>
  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
    <div
      className={`h-full rounded-full bg-gradient-to-r ${accent.bar} transition-all duration-300`}
      style={{ width: `${progress.percent}%` }}
    />
  </div>
</div>
```
No PhasePill, no finalise hint, no separate card wrapper. This lives INSIDE the form card.

### MODIFY: `components/data-entry/EditorStatusBanner.tsx`
Replace `EditorStatusBanners` with a new `EntryStatusStrip`:
- Single line, compact (h-10 or py-2)
- One component that handles ALL states with a switch
- Always at the top of the page (before form card)
- No multi-line explanations
- Status text is concise (max 60 chars)
- Action link inline (not a separate button)

### MODIFY: `components/entry/EntryActionsBar.tsx`
Simplify EditModeActionBar:
- Remove celebration banner state machine — replace with a brief toast via `showToast`
- Show only ONE primary workflow button at a time (Generate OR Finalise, never both)
- Clean up the nested conditionals
- Reduce button count in view mode

### MODIFY: `components/data-entry/CategoryEntryPageShell.tsx`
Update the form mode render order:
1. EntryStatusStrip (new, compact)
2. Form card (contains progress bar inside + form fields + compact document bar + uploads)
3. Metadata footer (collapsed by default)

Remove the separate `EditorProgressHeader` as a standalone component above the form.

### MODIFY: `components/data-entry/adapters/BaseEntryAdapter.tsx`
- Move progress header inside the form card, before form fields
- Remove the separate `EntryDocumentSection` as a block; make it a compact bar inside the form
- Add a "Supporting Documents" divider before stage 2 upload fields
- Ensure `formCard.content` renders in this order:
  1. Progress bar (minimal)
  2. Stage 1 form fields
  3. Compact document bar
  4. Divider: "Supporting Documents"
  5. Stage 2 upload fields

## Color Palette (consistent across states)
- DRAFT: slate (neutral)
- GENERATED + editable: blue (active)
- GENERATED + finalized: emerald (complete)
- EDIT_REQUESTED: amber (waiting)
- EDIT_GRANTED: purple (temporary access)
- DELETE_REQUESTED: red (danger)
- ARCHIVED: slate-400 (inactive)

## DO NOT CHANGE
- Business logic (hash computation, staleness, streak rules)
- API endpoints or server-side code
- Schema definitions
- Hook logic (useEntryEditor, useEntrySaveOrchestration, etc.)
- Only change the VISUAL PRESENTATION and COMPONENT STRUCTURE

## Verification
1. npm run build — passes
2. npm test — 352+ tests pass
3. npm run dev — test each state:
   a. New entry (DRAFT): clean form, no document section, progress bar in form
   b. Fill fields, save: progress updates
   c. Generate: compact "Document ready" bar, Finalise button appears
   d. Upload stage 2 files: no effect on document status
   e. Edit stage 1 field: "Document outdated" compact bar
   f. Finalise: green status strip, read-only form, Request Action dropdown
   g. Request Edit: amber status strip, Finalise hidden, Cancel Request visible
   h. View archived: gray status strip, no actions
