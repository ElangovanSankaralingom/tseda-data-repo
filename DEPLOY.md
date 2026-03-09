# Deployment Guide

## Prerequisites

- Node.js 22+ (LTS recommended)
- npm 10+

## Required Environment Variables

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID (from Google Cloud Console) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret |
| `NEXTAUTH_SECRET` | Random secret for JWT signing. Generate with: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Full base URL of the deployment (e.g., `https://tseda.tce.edu`) |

## Optional Environment Variables

| Variable | Default | Description |
|---|---|---|
| `CRON_SECRET` | *(disabled)* | Shared secret for `/api/cron/nightly`. If blank, the cron endpoint rejects all requests. |
| `DATA_ROOT` | `.data` | Root directory for file-based storage |
| `DATA_BACKUP_ROOT` | `.data/backups` | Directory for backup archives |
| `LOG_LEVEL` | `info` | Logging level: `debug`, `info`, `warn`, `error` |

## First-Time Setup

1. Clone the repository
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in all required variables
4. Ensure the data directory is writable:
   ```bash
   mkdir -p .data/users
   chmod 755 .data
   ```
5. Build and start:
   ```bash
   npm run build
   npm start
   ```

## Data Directory

The app uses file-based JSON storage (no database). All data lives under the `DATA_ROOT` directory (default: `.data/`).

Structure:
```
.data/
├── users/<email>/         # Per-user data stores
│   ├── fdp-attended.json
│   ├── fdp-conducted.json
│   ├── case-studies.json
│   ├── guest-lectures.json
│   ├── workshops.json
│   ├── index.json         # Pre-computed user index
│   ├── notifications.json # Persistent notifications
│   └── events.log         # Write-ahead log
├── backups/               # Backup archives
├── telemetry/
│   └── events.log         # Global telemetry log
└── maintenance-log.json   # Maintenance action history
```

**Important:** The `.data/` directory must be writable by the Node.js process. Back it up regularly — it is the only persistent state.

## Cron Job Setup

The nightly maintenance pipeline runs backup, integrity checks, auto-archive, edit grant expiry, timer warnings, and WAL compaction.

Set up an external scheduler (cron, systemd timer, or cloud scheduler) to hit:

```
POST /api/cron/nightly
Authorization: Bearer <CRON_SECRET>
```

Recommended schedule: once daily at 2:00 AM IST.

Example crontab entry:
```bash
0 2 * * * curl -s -X POST https://tseda.tce.edu/api/cron/nightly -H "Authorization: Bearer YOUR_CRON_SECRET"
```

The endpoint is rate-limited to 2 invocations per hour.

## Admin Access

The master admin is `senarch@tce.edu` (hardcoded in `lib/admin.ts`). This account has full access to:
- Admin console (`/admin`)
- Confirmation management
- Maintenance dashboard (`/maintenance`)
- Data export

Additional admins can be configured via the admin role management UI.

## Health Check

`GET /api/health` — unauthenticated endpoint that returns:
```json
{
  "status": "healthy",
  "timestamp": "2026-03-09T...",
  "storage": "accessible",
  "users": 42,
  "version": "0.3.0",
  "node": "v22.x.x"
}
```

Use this for uptime monitoring and load balancer health checks.

## Production Checklist

- [ ] All required env vars set
- [ ] `.data/` directory exists and is writable
- [ ] `CRON_SECRET` set and cron job configured
- [ ] Google OAuth redirect URI matches `NEXTAUTH_URL`
- [ ] `faculty.json` populated with authorized faculty emails
- [ ] Health check returns `"status": "healthy"`
- [ ] Backup strategy in place for `.data/` directory
- [ ] Log level set to `info` or `warn` for production
