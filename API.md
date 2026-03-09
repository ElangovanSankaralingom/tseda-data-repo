# API Reference

All routes are under `/api/`. Authentication uses NextAuth v4 with Google OAuth (`@tce.edu` domain only).

## Auth Routes

| Method | Path | Auth | Rate Limited | Description |
|---|---|---|---|---|
| GET, POST | `/api/auth/[...nextauth]` | NextAuth handler | No | Google OAuth sign-in/sign-out/callback |

## User Routes (`/api/me/*`)

### Profile

| Method | Path | Auth | Rate Limited | Description |
|---|---|---|---|---|
| GET | `/api/me` | Yes | No | Get current user profile |
| PUT | `/api/me` | Yes | No | Update user profile |
| GET | `/api/me/admin-capabilities` | Yes | No | Check user's admin permissions |
| POST | `/api/me/reset` | Yes | No | Reset all user data |

### Entry Management (Generic)

| Method | Path | Auth | Rate Limited | Description |
|---|---|---|---|---|
| POST | `/api/me/entry/commit` | Yes | Yes (entryMutations) | Commit a draft entry |
| POST | `/api/me/entry/confirmation` | Yes | Yes (entryMutations) | Send entry for admin confirmation |
| POST | `/api/me/entry/generate` | No* | No | Generate/create new entry |
| POST | `/api/me/entries/[category]/[id]/generate` | Yes | No | Generate PDF for any category entry |

\* Requires `@tce.edu` email in payload.

### FDP Attended

| Method | Path | Auth | Rate Limited | Description |
|---|---|---|---|---|
| GET | `/api/me/fdp-attended` | Yes | No | List FDP attended entries |
| POST | `/api/me/fdp-attended` | Yes | Yes (entryMutations) | Create FDP attended entry |
| PATCH | `/api/me/fdp-attended` | Yes | Yes (entryMutations) | Update FDP attended entry |
| DELETE | `/api/me/fdp-attended` | Yes | No | Delete FDP attended entry |
| PATCH | `/api/me/fdp-attended/[id]` | Yes | Yes (entryMutations) | Request edit for submitted entry |
| POST | `/api/me/fdp-attended/[id]/pdf` | Yes | No | Generate PDF |
| POST | `/api/me/fdp-file` | Yes | Yes (uploadOps) | Upload FDP file (permission letter, certificate) |
| DELETE | `/api/me/fdp-file` | Yes | Yes (uploadOps) | Delete FDP file |

### FDP Conducted

| Method | Path | Auth | Rate Limited | Description |
|---|---|---|---|---|
| GET | `/api/me/fdp-conducted` | Yes | No | List FDP conducted entries |
| POST | `/api/me/fdp-conducted` | Yes | Yes (entryMutations) | Create FDP conducted entry |
| PATCH | `/api/me/fdp-conducted` | Yes | Yes (entryMutations) | Update FDP conducted entry |
| DELETE | `/api/me/fdp-conducted` | Yes | No | Delete FDP conducted entry |
| PATCH | `/api/me/fdp-conducted/[id]` | Yes | Yes (entryMutations) | Request edit for submitted entry |
| POST | `/api/me/fdp-conducted/[id]/pdf` | Yes | No | Generate PDF |
| POST | `/api/me/fdp-conducted-file` | Yes | Yes (uploadOps) | Upload FDP conducted file |
| DELETE | `/api/me/fdp-conducted-file` | Yes | Yes (uploadOps) | Delete FDP conducted file |

### Guest Lectures

| Method | Path | Auth | Rate Limited | Description |
|---|---|---|---|---|
| GET | `/api/me/guest-lectures` | Yes | No | List guest lecture entries |
| POST | `/api/me/guest-lectures` | Yes | Yes (entryMutations) | Create guest lecture entry |
| PATCH | `/api/me/guest-lectures` | Yes | Yes (entryMutations) | Update guest lecture entry |
| DELETE | `/api/me/guest-lectures` | Yes | No | Delete guest lecture entry |
| POST | `/api/me/guest-lectures/[id]/pdf` | Yes | No | Generate PDF |
| POST | `/api/me/guest-lectures-file` | Yes | Yes (uploadOps) | Upload guest lecture file |
| DELETE | `/api/me/guest-lectures-file` | Yes | Yes (uploadOps) | Delete guest lecture file |

### Case Studies

| Method | Path | Auth | Rate Limited | Description |
|---|---|---|---|---|
| GET | `/api/me/case-studies` | Yes | No | List case study entries |
| POST | `/api/me/case-studies` | Yes | Yes (entryMutations) | Create case study entry |
| PATCH | `/api/me/case-studies` | Yes | Yes (entryMutations) | Update case study entry |
| DELETE | `/api/me/case-studies` | Yes | No | Delete case study entry |
| POST | `/api/me/case-studies/[id]/pdf` | Yes | No | Generate PDF |
| POST | `/api/me/case-studies-file` | Yes | Yes (uploadOps) | Upload case study file |
| DELETE | `/api/me/case-studies-file` | Yes | Yes (uploadOps) | Delete case study file |

### Workshops

| Method | Path | Auth | Rate Limited | Description |
|---|---|---|---|---|
| GET | `/api/me/workshops` | Yes | No | List workshop entries |
| POST | `/api/me/workshops` | Yes | Yes (entryMutations) | Create workshop entry |
| PATCH | `/api/me/workshops` | Yes | Yes (entryMutations) | Update workshop entry |
| DELETE | `/api/me/workshops` | Yes | No | Delete workshop entry |
| POST | `/api/me/workshops/[id]/pdf` | Yes | No | Generate PDF |
| POST | `/api/me/workshops-file` | Yes | Yes (uploadOps) | Upload workshop file |
| DELETE | `/api/me/workshops-file` | Yes | Yes (uploadOps) | Delete workshop file |

### Files & Media

| Method | Path | Auth | Rate Limited | Description |
|---|---|---|---|---|
| GET | `/api/me/file` | Yes | No | List/download user files |
| POST | `/api/me/file` | Yes | Yes (uploadOps) | Upload general file |
| DELETE | `/api/me/file` | Yes | Yes (uploadOps) | Delete general file |
| GET | `/api/me/file/download` | Yes | No | Download file from storage |
| POST | `/api/me/avatar` | Yes | No | Upload avatar photo |
| DELETE | `/api/me/avatar` | Yes | No | Delete avatar photo |
| GET | `/api/me/certificate` | Yes | No | Download experience certificate |
| POST | `/api/me/certificate` | Yes | No | Upload experience certificate |
| DELETE | `/api/me/certificate` | Yes | No | Delete experience certificate |
| GET | `/api/me/experience/certificate` | Yes | No | Download academic experience certificate |
| POST | `/api/me/experience/certificate` | Yes | No | Upload academic experience certificate |
| DELETE | `/api/me/experience/certificate` | Yes | No | Delete academic experience certificate |
| GET | `/api/file` | Yes | No | Download file (legacy path) |

## Admin Routes (`/api/admin/*`)

| Method | Path | Auth | Rate Limited | Description |
|---|---|---|---|---|
| GET | `/api/admin/confirmations` | Admin (canApproveConfirmations) | Yes (adminOps) | List pending confirmations |
| PATCH | `/api/admin/confirmations` | Admin (canApproveConfirmations) | Yes (adminOps) | Approve or reject entry |
| GET | `/api/admin/export/entries` | Admin (canExport) | Yes (adminOps) | Export entries as CSV/XLSX |
| GET | `/api/admin/export` | Admin (canExport) | No | Deprecated (returns 410) |

## Faculty Routes

| Method | Path | Auth | Rate Limited | Description |
|---|---|---|---|---|
| GET | `/api/faculty` | Yes | No | List faculty directory |
| POST | `/api/faculty` | Admin (canAccessAdminConsole) | No | Add faculty member |
| PUT | `/api/faculty` | Admin (canAccessAdminConsole) | No | Update faculty member |
| DELETE | `/api/faculty` | Admin (canAccessAdminConsole) | No | Remove faculty member |

## Telemetry Routes

| Method | Path | Auth | Rate Limited | Description |
|---|---|---|---|---|
| POST | `/api/telemetry` | Yes | Yes (240/60s) | Record frontend telemetry event |

## Cron Routes

| Method | Path | Auth | Rate Limited | Description |
|---|---|---|---|---|
| GET, POST | `/api/cron/nightly` | Cron secret header | No | Nightly maintenance job |

## Health Routes

| Method | Path | Auth | Rate Limited | Description |
|---|---|---|---|---|
| GET | `/api/health` | No | No | System health check (storage, user count, version, node) |

## Admin Maintenance Routes (`/api/admin/maintenance/*`)

| Method | Path | Auth | Rate Limited | Description |
|---|---|---|---|---|
| POST | `/api/admin/maintenance/backup` | Admin | No | Create full .data backup zip |
| POST | `/api/admin/maintenance/integrity-check` | Admin | No | Scan all users for data issues |
| POST | `/api/admin/maintenance/wal-compact` | Admin | No | Trim old WAL event log entries |
| POST | `/api/admin/maintenance/cleanup` | Admin | No | Remove temp files and empty dirs |
| POST | `/api/admin/maintenance/rebuild-indexes` | Admin | No | Rebuild user index files from stores |
| POST | `/api/admin/maintenance/migrate` | Admin | No | Apply data migrations to all users |
| GET | `/api/admin/maintenance/stats` | Admin | No | System stats (users, storage, WAL, backups) |
| GET | `/api/admin/maintenance/log` | Admin | No | Recent maintenance action log |

## Debug Routes

| Method | Path | Auth | Rate Limited | Description |
|---|---|---|---|---|
| GET | `/api/debug/session` | Master admin only | No | Debug session info (dev only, 404 in production) |

## Rate Limit Presets

Defined in `lib/security/rateLimit.ts`:

| Preset | Window | Max Requests |
|---|---|---|
| `entryMutations` | 60 seconds | 30 |
| `uploadOps` | 60 seconds | 20 |
| `adminOps` | 60 seconds | 60 |

Rate-limited routes return `429 Too Many Requests` when exceeded.

## Error Response Format

All mutation routes return errors via category-specific `mutationErrorResponse` functions:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

Common error codes: `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `RATE_LIMITED`, `FORBIDDEN`.
