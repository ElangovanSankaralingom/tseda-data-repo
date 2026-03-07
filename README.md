# T'SEDA Data Repository

Faculty professional development data collection and management platform for Thiagarajar College of Engineering.

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19
- **Styling:** Tailwind CSS 4, shadcn/ui (Radix primitives)
- **Auth:** NextAuth v4 with Google OAuth (restricted to `@tce.edu`)
- **Storage:** File-based JSON (no database)
- **PDF:** pdf-lib for certificate/report generation
- **Testing:** Node.js built-in test runner

## Prerequisites

- Node.js 22+
- npm
- Google OAuth credentials (client ID + secret)

## Setup

```bash
git clone <repo-url>
cd tseda-data-repo
npm install
cp .env.example .env    # Fill in your credentials
npm run dev             # http://localhost:3000
```

### Environment Variables

See `.env.example` for required variables:

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXTAUTH_SECRET` | Random secret for JWT signing (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Base URL (e.g., `http://localhost:3000`) |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm test` | Run all tests |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check with TypeScript |
| `npm run migrate:data` | Run data migrations |
| `npm run backup:data` | Back up `.data/` directory |

### Running a single test

```bash
NODE_ENV=test node --test --experimental-strip-types \
  --experimental-loader ./tests/helpers/pathAliasLoader.mjs \
  tests/entries/<testfile>.test.ts
```

## Project Structure

```
app/                        # Next.js App Router
  (protected)/              # Auth-gated pages (dashboard, data-entry, admin)
  api/                      # API routes (auth, user, admin, file, telemetry)
components/                 # React components (ui/, data-entry/, entry/)
data/
  categoryRegistry.ts       # Category definitions (5 categories)
  schemas/                  # Per-category field schemas
  faculty.json              # Faculty directory
hooks/                      # Shared React hooks
lib/
  entries/                  # Workflow, lifecycle, editor rules
  data/                     # Storage layer (indexStore, WAL, locks, atomic writes)
  export/                   # Export pipeline
  types/                    # Canonical type definitions
  migrations/               # Schema migration logic
  security/                 # Rate limiting
.data/                      # Runtime data (git-ignored)
  users/<email>/            # Per-user JSON stores, index, WAL
tests/                      # Node.js built-in test runner tests
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full canonical architecture document.

## Data Categories

| Category | Description |
|---|---|
| FDP Attended | Faculty development programmes attended |
| FDP Conducted | Faculty development programmes conducted/organized |
| Case Studies | Industrial visits and case studies |
| Guest Lectures | Guest lectures organized |
| Workshops | Workshops organized |

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — Canonical architecture freeze and ownership rules
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) — UI/UX patterns, color system, component specs
- [CONTRIBUTING.md](CONTRIBUTING.md) — Branch workflow, commit conventions, PR checklist
- [DATA_MODEL.md](DATA_MODEL.md) — File-based storage structure and formats
- [API.md](API.md) — All API endpoints with auth and rate-limit status
- [CHANGELOG.md](CHANGELOG.md) — Version history
