# Streak System Specification

## Two Checkpoints Only
1. **Generate PDF -> gate to Activated** (check end date, if future = streak eligible)
2. **Finalise Entry -> gate to Wins** (eligible + all mandatory fields + valid PDF + finalized)

## Activated Conditions (ALL must be true)
- Status is GENERATED (not DRAFT, not ARCHIVED)
- pdfGenerated === true (or pdfGeneratedAt exists as fallback)
- streakEligible === true (end date was future at Generate PDF time)
- NOT finalized
- streakPermanentlyRemoved !== true

## Win Conditions (ALL must be true)
- Entry is finalized (timer expired or manual Finalise Now)
- All mandatory fields complete
- Valid (non-stale) PDF exists
- streakEligible === true
- streakPermanentlyRemoved !== true

## End Date Exception
- End date changed to past (on save) -> immediately removes from Activated (recoverable: change back + regenerate)
- End date changed to future (on save) -> does NOT auto-restore, must regenerate PDF

## Permanent Removal
- Edit/Delete request on a WIN entry -> permanent removal (streakPermanentlyRemoved = true)
- Does NOT apply to Activated entries -- only Wins
- Archive or restore -> permanent removal

## What Does NOT Affect Streaks
- Editing any field except end date
- PDF becoming stale
- GENERATED -> DRAFT revert
- Admin granting/rejecting requests
- Sending edit/delete request on Activated entries

## Dashboard Display
- Journey funnel: [Eligible: X] -> [Activated: Y] -> [Wins: Z]

## Entry Fields for Streak
- streakEligible?: boolean (set at Generate PDF)
- streakPermanentlyRemoved?: boolean (set when Win gets request or entry restored)
- pdfGenerated?: boolean (set at Generate PDF)
- pdfGeneratedAt?: string (ISO timestamp)
- pdfStale?: boolean (computed from pdfSourceHash comparison)
- permanentlyLocked?: boolean (set after second finalization)

## Source of Truth Files
- lib/streakProgress.ts -- isEntryActivated, isEntryWon, computeCanonicalStreakSnapshot
- lib/entries/postSave.ts -- normalizeEntryStreakFields
- lib/pdfSnapshot.ts -- hashPrePdfFields, computePdfState, getHashPayload
