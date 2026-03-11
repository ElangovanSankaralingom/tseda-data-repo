# Timer Expiry Rules — Complete Implementation

## Rules

### Timer Behavior
- Timer RUNS during: GENERATED, EDIT_GRANTED, DRAFT
- Timer PAUSES during: EDIT_REQUESTED, DELETE_REQUESTED
- Timer RESUMES when admin acts (grant/reject)

### Timer Pause Implementation
When entry transitions to EDIT_REQUESTED or DELETE_REQUESTED:
- Record `timerPausedAt: new Date().toISOString()`
- Record `timerRemainingMs: editWindowExpiresAt - now` (remaining time when paused)

When admin acts (grant edit, reject edit, reject delete):
- Set new `editWindowExpiresAt = now + timerRemainingMs`
- Clear `timerPausedAt` and `timerRemainingMs`

When admin approves delete:
- Entry is permanently deleted, timer irrelevant

### On Timer Expiry (nightly cron job checks)

**GENERATED entries (normal flow):**
- Check: all stage 1 fields filled? all stage 2 uploads present? PDF exists and not stale?
  - YES to all → Set `permanentlyLocked: true`, entry is auto-finalised
  - NO to any → Permanently delete entry + uploaded files from disk

**EDIT_GRANTED entries:**
- Check: were any changes made since edit was granted? (compare current hash vs hash at grant time)
  - No changes + all fields complete + PDF valid → Set `permanentlyLocked: true`, auto-finalise
  - Changes made but no regenerate (PDF stale) → Permanently delete
  - Fields incomplete → Permanently delete

**EDIT_REQUESTED entries:**
- Timer is paused — SKIP, do not process
  
**DELETE_REQUESTED entries:**
- Timer is paused — SKIP, do not process

### Admin Actions
**Grant edit:**
- Resume timer (new editWindowExpiresAt = now + timerRemainingMs)
- Record `hashAtEditGrant` (hash of stage 1 fields when edit was granted)
- Entry becomes EDIT_GRANTED

**Reject edit:**
- Set `permanentlyLocked: true`
- Clear timer fields

**Approve delete:**
- Permanently delete entry + files (already implemented)

**Reject delete:**
- Set `permanentlyLocked: true` (permanently accepted/finalised)
- Clear timer fields

## Implementation

### 1. Add new fields to entry schema

In lib/types/entry.ts, add to EntryLifecycleFields:
```typescript
timerPausedAt?: string | null;
timerRemainingMs?: number | null;
hashAtEditGrant?: string | null;
```

### 2. Pause timer on request

In lib/entries/internal/engineRequests.ts:

In `requestEdit` function, after transitioning to EDIT_REQUESTED:
```typescript
const now = Date.now();
const expiresAt = entry.editWindowExpiresAt ? new Date(entry.editWindowExpiresAt).getTime() : now;
const remainingMs = Math.max(0, expiresAt - now);
(next as Record<string, unknown>).timerPausedAt = new Date().toISOString();
(next as Record<string, unknown>).timerRemainingMs = remainingMs;
```

In `requestDelete` function, same logic:
```typescript
const now = Date.now();
const expiresAt = entry.editWindowExpiresAt ? new Date(entry.editWindowExpiresAt).getTime() : now;
const remainingMs = Math.max(0, expiresAt - now);
(next as Record<string, unknown>).timerPausedAt = new Date().toISOString();
(next as Record<string, unknown>).timerRemainingMs = remainingMs;
```

### 3. Resume timer on admin action

In lib/entries/internal/engineAdmin.ts:

In `grantEditAccess`, after transitioning to EDIT_GRANTED:
```typescript
const remainingMs = typeof existing.timerRemainingMs === "number" ? existing.timerRemainingMs : 3 * 24 * 60 * 60 * 1000; // fallback 3 days
(next as Record<string, unknown>).editWindowExpiresAt = new Date(Date.now() + remainingMs).toISOString();
(next as Record<string, unknown>).timerPausedAt = null;
(next as Record<string, unknown>).timerRemainingMs = null;
// Record hash at grant time for change detection
const { hashPrePdfFields } = await import("@/lib/pdfSnapshot");
(next as Record<string, unknown>).hashAtEditGrant = hashPrePdfFields(existing, category);
```

In `rejectEditRequest`:
```typescript
(next as Record<string, unknown>).timerPausedAt = null;
(next as Record<string, unknown>).timerRemainingMs = null;
(next as Record<string, unknown>).editWindowExpiresAt = null;
(next as Record<string, unknown>).permanentlyLocked = true;
```

In reject delete (if it exists, or add it):
```typescript
(next as Record<string, unknown>).timerPausedAt = null;
(next as Record<string, unknown>).timerRemainingMs = null;
(next as Record<string, unknown>).editWindowExpiresAt = null;
(next as Record<string, unknown>).permanentlyLocked = true;
```

### 4. Update isEditWindowExpired to respect paused state

In lib/entries/workflow.ts, find `isEditWindowExpired`:

Add a check: if `timerPausedAt` is set, the timer is paused — return false (not expired):
```typescript
export function isEditWindowExpired(entry: WorkflowEntryLike, nowISO?: string): boolean {
  // Timer is paused during pending requests
  if ((entry as Record<string, unknown>).timerPausedAt) return false;
  
  const expiresAt = toOptionalISO((entry as Record<string, unknown>).editWindowExpiresAt);
  if (!expiresAt) return false;
  const now = nowISO ? new Date(nowISO) : new Date();
  return now >= new Date(expiresAt);
}
```

### 5. Update nightly cron job for auto-delete and auto-finalise

In app/api/cron/nightly/route.ts or lib/jobs/autoArchive.ts:

For each user's entries where editWindowExpiresAt has passed:

```typescript
async function processExpiredEntries() {
  for each user:
    for each category:
      for each entry:
        const status = normalizeEntryStatus(entry);
        
        // Skip paused entries
        if (status === "EDIT_REQUESTED" || status === "DELETE_REQUESTED") continue;
        if (entry.timerPausedAt) continue;
        
        // Skip already locked
        if (entry.permanentlyLocked) continue;
        
        // Check if timer expired
        if (!isEditWindowExpired(entry)) continue;
        
        // Check completeness
        const schema = getCategorySchema(category);
        const allFieldsComplete = checkAllFieldsComplete(entry, schema);
        const pdfValid = entry.pdfGenerated && !entry.pdfStale;
        
        if (status === "EDIT_GRANTED") {
          // Check if changes were made since grant
          const currentHash = hashPrePdfFields(entry, category);
          const grantHash = entry.hashAtEditGrant;
          const changesWereMade = grantHash && currentHash !== grantHash;
          
          if (!changesWereMade && allFieldsComplete && pdfValid) {
            // No changes, all complete → auto-finalise
            entry.permanentlyLocked = true;
            entry.confirmationStatus = "GENERATED";
            persist(entry);
          } else {
            // Changes made but incomplete/stale → auto-delete
            permanentlyDeleteEntry(user, category, entry);
          }
        } else if (status === "GENERATED") {
          if (allFieldsComplete && pdfValid) {
            // All complete → auto-finalise
            entry.permanentlyLocked = true;
            persist(entry);
          } else {
            // Incomplete → auto-delete
            permanentlyDeleteEntry(user, category, entry);
          }
        }
}
```

The `permanentlyDeleteEntry` function should reuse the same logic from `approveDelete` — delete entry JSON + uploaded files.

### 6. Frontend: Show paused timer state

In the entry card and view mode, when timer is paused (EDIT_REQUESTED or DELETE_REQUESTED):
- Don't show countdown timer
- Show "Timer paused" or just hide the timer entirely

In the edit time display logic, check `timerPausedAt`:
```typescript
if (entry.timerPausedAt) {
  // Show "Timer paused" or hide timer
} else {
  // Show normal countdown
}
```

### 7. Cancel request: Resume timer but mark permanently locked

In cancelEditRequest and cancelDeleteRequest:
- Resume timer: `editWindowExpiresAt = now + timerRemainingMs`
- Set `permanentlyLocked = true` (already implemented)
- Clear `timerPausedAt` and `timerRemainingMs`

Wait — if permanently locked, the timer doesn't matter. The entry is already locked. So just:
```typescript
(next as Record<string, unknown>).timerPausedAt = null;
(next as Record<string, unknown>).timerRemainingMs = null;
(next as Record<string, unknown>).permanentlyLocked = true;
```

### Verification
1. npm run build — passes
2. npm test — update/add tests for:
   - Timer pauses on EDIT_REQUESTED
   - Timer resumes on grant edit with correct remaining time
   - isEditWindowExpired returns false when paused
   - Nightly job auto-finalises complete entries
   - Nightly job auto-deletes incomplete entries
3. npm run dev:
   a. Create entry, generate, upload, DON'T finalise → wait for timer → auto-finalised
   b. Create entry, generate, DON'T upload → timer expires → auto-deleted
   c. Request edit → timer pauses → admin grants → timer resumes with remaining time
   d. Request edit → timer pauses → admin rejects → permanently locked
   e. Request delete → timer pauses → admin approves → permanently deleted
   f. Request delete → timer pauses → admin rejects → permanently locked
