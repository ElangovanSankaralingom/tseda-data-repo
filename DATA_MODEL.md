# Data Model

File-based JSON storage with no external database. All runtime data lives under `.data/` (git-ignored).

## Directory Layout

```
.data/
├── users/
│   └── <email>/                    # One directory per user (email sanitized for filesystem)
│       ├── index.json              # Pre-computed aggregates (UserIndex)
│       ├── events.log              # Write-ahead log (JSONL)
│       ├── fdp-attended.json       # Category store
│       ├── fdp-conducted.json
│       ├── case-studies.json
│       ├── guest-lectures.json
│       └── workshops.json
├── admin/
│   ├── admin-users.json            # Admin role assignments
│   └── notifications.json          # Admin notification queue
├── telemetry/
│   └── events.log                  # App-wide telemetry events
├── maintenance/                    # Maintenance logs
└── profiles/
    └── <email>.json                # User profile data

public/uploads/
└── <email>/                        # Uploaded files (PDFs, permission letters, certificates)
```

Path resolution: `lib/userStore.ts` -- `getUserStoreDir(email)` returns `.data/users/<safeEmailDir(email)>/`.

## Category Store Format

Each category file uses **version 2** format (defined in `lib/migrations/index.ts` as `CategoryStoreV2`):

```json
{
  "version": 2,
  "byId": {
    "<entry-id>": { ... },
    "<entry-id>": { ... }
  },
  "order": ["<entry-id>", "<entry-id>"]
}
```

- `byId` -- map of entry ID to entry object
- `order` -- array of entry IDs preserving insertion order

### Entry Shape

Defined in `lib/types/entry.ts`. Every entry is a `Record<string, unknown>` with these known fields:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | UUID (generated via `crypto.randomUUID()`) |
| `category` | `string` | Category slug (e.g., `fdp-attended`) |
| `ownerEmail` | `string` | User's email address |
| `schemaVersion` | `number` | Entry schema version (currently 1) |
| `confirmationStatus` | `EntryStatus` | Canonical workflow status |
| `createdAt` | `string` | ISO 8601 timestamp |
| `updatedAt` | `string` | ISO 8601 timestamp |
| `committedAtISO` | `string` | ISO 8601 timestamp of first GENERATED transition |
| `editWindowExpiresAt` | `string` | ISO 8601 timestamp when edit timer expires |
| `pdfGenerated` | `boolean` | Whether PDF has been generated |
| `pdfGeneratedAt` | `string` | ISO 8601 timestamp of last PDF generation |
| `pdfSourceHash` | `string` | Hash of Stage 1 fields at PDF generation time |
| `pdfStale` | `boolean` | Computed: true if current fields don't match pdfSourceHash |
| `pdfUrl` | `string` | Path to generated PDF file |
| `streakEligible` | `boolean` | Whether entry qualifies for streak (end date was future at Generate time) |
| `streakPermanentlyRemoved` | `boolean` | Whether entry was permanently removed from streak counts |
| `permanentlyLocked` | `boolean` | Set true after second finalization; blocks Request Edit |
| `permissionLetter` | `FileMeta[]` | Uploaded permission letter files (Stage 2) |
| `completionCertificate` | `FileMeta[]` | Uploaded completion certificate files (Stage 2) |
| `geotaggedPhotos` | `FileMeta[]` | Uploaded geotagged photo files (Stage 2) |
| `attendanceSheet` | `FileMeta[]` | Uploaded attendance sheet files (Stage 2) |
| `officialPoster` | `FileMeta[]` | Uploaded official poster files (Stage 2) |
| `travelPlan` | `FileMeta[]` | Uploaded travel plan files (Stage 2) |
| `report` | `FileMeta[]` | Uploaded report files (Stage 2) |
| `feedback` | `FileMeta[]` | Uploaded feedback files (Stage 2) |
| `advanceClosure` | `FileMeta[]` | Uploaded advance closure files (Stage 2) |
| `attachments` | `UploadedFile[]` | Uploaded file metadata |
| `data` | `Record<string, unknown>` | Category-specific field values |

### Workflow Statuses

Canonical values (defined in `lib/types/entry.ts`):

- `DRAFT` -- initial state, editable
- `GENERATED` -- committed with PDF generated, in edit window or finalized
- `EDIT_REQUESTED` -- user requested edit on finalized entry, awaiting admin
- `DELETE_REQUESTED` -- user requested deletion, awaiting admin
- `EDIT_GRANTED` -- admin granted edit access, user can modify and re-finalize
- `ARCHIVED` -- entry deleted/archived after admin approval

### Two-Stage Field Model

**Stage 1 (data fields):** Text inputs, dates, selections, descriptions. Changes to these fields mark the PDF as stale. The PDF must be regenerated before finalizing. Stage 1 fields are hashed by `lib/pdfSnapshot.ts:hashPrePdfFields()` to detect staleness.

**Stage 2 (file uploads):** Permission letters, completion certificates, geotagged photos, brochures. Changes to these fields do NOT affect PDF staleness. Users can upload/remove files freely without regenerating the PDF.

### Per-Category Fields

Each category stores its own set of Stage 1 (data) and Stage 2 (upload) fields on the entry. Upload fields are all `FileMeta[]` arrays. The `sponsored` pattern uses three fields: `sponsored` (Yes/No), `fundingAgency` (string, shown when sponsored=Yes), and `fundingAmount` (number, shown when sponsored=Yes).

**FDP Attended:**
Stage 1: `academicYear`, `semesterType`, `level`, `mode`, `startDate`, `endDate`, `programName`, `organisingBody`, `sponsored`, `fundingAgency`, `fundingAmount`
Stage 2: `permissionLetter[]`, `completionCertificate[]`

**FDP Conducted:**
Stage 1: `academicYear`, `semesterType`, `level`, `mode`, `startDate`, `endDate`, `programName`, `coCoordinators`, `sponsored`, `fundingAgency`, `fundingAmount`, `numberOfParticipants`
Stage 2: `permissionLetter[]`, `geotaggedPhotos[]`, `attendanceSheet[]`, `officialPoster[]`

**Guest Lectures:**
Stage 1: `academicYear`, `semesterType`, `level`, `mode`, `startDate`, `endDate`, `topicOfLecture`, `guestSpeakerName`, `guestSpeakerDesignation`, `guestSpeakerOrganisation`, `coCoordinators`, `sponsored`, `fundingAgency`, `fundingAmount`, `numberOfParticipants`
Stage 2: `permissionLetter[]`, `geotaggedPhotos[]`, `attendanceSheet[]`, `officialPoster[]`

**Case Studies:**
Stage 1: `academicYear`, `yearOfStudy`, `currentSemester`, `startDate`, `endDate`, `placeOfVisit`, `purposeOfVisit`, `staffAccompanying`, `sponsored`, `fundingAgency`, `fundingAmount`, `numberOfParticipants`
Stage 2: `permissionLetter[]`, `travelPlan[]`, `geotaggedPhotos[]`, `report[]`, `feedback[]`, `advanceClosure[]`

**Workshops:**
Stage 1: `academicYear`, `semesterType`, `level`, `mode`, `startDate`, `endDate`, `workshopName`, `resourcePersonName`, `resourcePersonDesignation`, `resourcePersonOrganisation`, `coCoordinators`, `sponsored`, `fundingAgency`, `fundingAmount`, `numberOfParticipants`
Stage 2: `permissionLetter[]`, `geotaggedPhotos[]`, `attendanceSheet[]`, `officialPoster[]`

### Uploaded File Shape

```typescript
{
  id?: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;     // ISO 8601
  url: string;            // Public URL path
  storedPath: string;     // Filesystem path
}
```

## Index File Format

`index.json` stores pre-computed aggregates per user. Defined as `UserIndex` in `lib/data/indexStore.ts`.

```typescript
{
  version: 2,                                           // USER_INDEX_VERSION
  userEmail: string,
  updatedAt: string,                                    // ISO 8601
  totalsByCategory: Record<CategoryKey, number>,        // Entry count per category
  countsByStatus: Record<EntryStatus, number>,          // Count by workflow status
  pendingByCategory: Record<CategoryKey, number>,       // Pending requests per category
  approvedByCategory: Record<CategoryKey, number>,      // Finalized entries per category
  lastEntryAtByCategory: Record<CategoryKey, string | null>,  // Latest entry timestamp
  streakSnapshot: {
    ruleVersion: number,                                // Streak computation rule version
    streakActivatedCount: number,                       // Total activated streaks
    streakWinsCount: number,                            // Total wins
    byCategory: Record<CategoryKey, { activated: number, wins: number }>,
    activeEntries: Array<{
      id: string,
      categoryKey: CategoryKey,
      dueAtISO: string | null,
      sortAtISO: string | null,
    }>,
    lastComputedAt: string,                             // ISO 8601
  },
  searchIndexByEntryId: Record<string, SearchSnapshot>, // Full-text search cache
}
```

### When the Index Rebuilds vs. Updates Incrementally

**Full rebuild** triggers:

- First access (no `index.json` exists)
- Schema version mismatch (`version !== USER_INDEX_VERSION`)
- Streak rule version mismatch
- Missing required fields
- Last entry in a category deleted (requires fresh `lastEntryAtByCategory`)
- Entry mutation results in negative counts (indicates corruption)

**Incremental update** via `updateIndexForEntryMutation()`:

- Adjusts `totalsByCategory`, `countsByStatus`, `pendingByCategory`
- Updates `searchIndexByEntryId` for changed entries
- Recomputes streak snapshot from loaded entries

## WAL Format

`events.log` is an append-only JSONL file (one JSON object per line). Defined in `lib/data/wal.ts`.

Each line is a `WalEvent`:

```typescript
{
  v: 1,                           // WAL event schema version
  ts: string,                     // ISO 8601 timestamp
  actor: {
    email: string,
    role: "user" | "admin",
  },
  userEmail: string,              // Owner of the entry
  category: CategoryKey,
  entryId: string,
  action: WalAction,              // See below
  before: Entry | null,           // State before mutation (null for CREATE)
  after: Entry | null,            // State after mutation (null for DELETE)
  meta?: {
    reason?: string,              // Admin reason
    ip?: string,
    userAgent?: string,
    notes?: string,
  },
}
```

### WAL Actions

```
CREATE | UPDATE | DELETE
REQUEST_EDIT | REQUEST_DELETE | GRANT_EDIT | ARCHIVE
UPLOAD_ADD | UPLOAD_REMOVE | UPLOAD_REPLACE
```

### Sanitization

- Strings truncated to 8,192 characters
- Nested objects limited to 10 levels deep

## Atomic Write Mechanism

Defined in `lib/data/fileAtomic.ts`:

1. Create parent directories if needed
2. Write to temporary file: `{filePath}.tmp.{pid}.{timestamp}.{uuid}`
3. Atomically rename temp file to target path via `fs.rename()`

This guarantees no partial writes -- if the process crashes during write, the original file remains intact.

## Locking

Defined in `lib/data/locks.ts`:

- **Scope:** In-process promise-chain locks keyed by user email
- **Key format:** `user:<normalizedEmail>`
- **Mechanism:** Each lock waiter chains onto a `Promise` queue -- sequential execution guaranteed
- **Reentrant:** Uses `AsyncLocalStorage` to detect already-held locks (allows nested calls within the same lock)

### Limitations

- **Single-process only** -- locks are in-memory, no cross-process coordination
- **WAL grows unbounded** -- no compaction or rotation implemented
- **No cross-process safety** -- running multiple instances against the same `.data/` directory risks corruption

## Migration Boundary

`lib/migrations/index.ts` normalizes legacy data shapes on read.

### Version Constants

| Store | Current Version |
|---|---|
| Entry schema | 1 (`ENTRY_SCHEMA_VERSION`) |
| Category store | 2 (`CATEGORY_STORE_SCHEMA_VERSION`) |
| User index | 2 (`USER_INDEX_SCHEMA_VERSION`) |
| WAL event | 1 (`WAL_EVENT_SCHEMA_VERSION`) |

### What Migrations Handle

- **Entry:** Legacy lowercase statuses (`draft`, `final`, `pending`) -> canonical uppercase (`DRAFT`, `GENERATED`). Finalization flags -> `GENERATED`. Missing timestamps filled.
- **Category store:** Array format (v0) -> `{ version, byId, order }` (v2). Missing entry IDs generated.
- **User index:** Schema version bumps, search index normalization, streak snapshot structure.
- **WAL event:** Event structure normalization, nested entry migration.

After normalization, internal code uses only canonical shapes and statuses. Legacy values are never accepted past the migration boundary.

## Schema Field Annotations

Fields in `data/schemas/*.ts` support these annotations:

| Annotation | Type | Purpose |
|---|---|---|
| `kind` | `SchemaFieldKind` | Field type (`string`, `number`, `date`, `array`, `object`, `boolean`) |
| `required` | `boolean` | Validation enforcement |
| `stage` | `1 \| 2` | Stage 1 = data fields (affect PDF hash), Stage 2 = uploads |
| `upload` | `boolean` | Marks as upload field — auto-derives upload slots, PDF exclusion, integrity checks |
| `format` | `'currency'` | Display formatting (e.g., `Rs.` prefix in PDF) |
| `exportable` | `boolean` | Whether field appears in CSV/XLSX exports |
| `exportOrder` | `number` | Column ordering in exports |
| `exportFormatter` | `SchemaExportFormatter` | Export-specific formatting |
| `maxLength` | `number` | Max string length for validation |
| `min` / `max` | `number` | Numeric range validation |
| `enumValues` | `readonly (string \| number \| boolean)[]` | Allowed values |

## Action History Record

Stored in `.data/admin/action-history.json`:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | UUID |
| `timestamp` | `string` | ISO 8601 |
| `actionType` | `string` | `edit_granted`, `edit_rejected`, `delete_approved`, `delete_rejected`, `user_cancelled`, `auto_finalised`, `auto_deleted` |
| `entryId` | `string` | Entry ID |
| `category` | `string` | Category slug |
| `entryTitle` | `string` | Snapshot at time of action |
| `userEmail` | `string` | Entry owner |
| `userName` | `string` | Entry owner display name |
| `adminEmail` | `string?` | Admin who acted (null for auto/user actions) |
| `requestMessage` | `string?` | User's request message |

## User Preferences

Stored per-user, managed by `lib/preferences/` and `app/api/me/preferences/route.ts`:

| Field | Type | Options |
|---|---|---|
| `themeMode` | `string` | `'light'`, `'dark'`, `'color'` |
| `colorPalette` | `string` | `'ocean-blue'`, `'forest-green'`, `'royal-purple'`, `'sunset-warm'`, `'rose-pink'` |
| `language` | `string` | `'en'`, `'ta'` |

## Category Registry Metadata

Each category in `data/categoryRegistry.ts` includes:

| Field | Type | Purpose |
|---|---|---|
| `slug` | `CategorySlug` | URL-safe identifier |
| `label` | `string` | Display name (English fallback) |
| `entryTitleField` | `string?` | Which entry field is the display title |
| `entryTitleFallback` | `string?` | Fallback title when field is empty |
| `icon` | `string` | Lucide icon name (resolved client-side) |
| `color` | `CategoryColor` | Accent colors (accentBg, borderTop, buttonBg, text, gradient, etc.) |
| `schema` | `EntrySchema` | Bound schema with field definitions |
