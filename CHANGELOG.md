# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] - 2026-03-07

Initial architecture documentation and infrastructure hardening.

### Features

- **5 data categories:** FDP Attended, FDP Conducted, Case Studies, Guest Lectures, Workshops
- **Entry workflow:** DRAFT → PENDING_CONFIRMATION → APPROVED/REJECTED with admin approval
- **Gamification:** Streak tracking and progress visualization across categories
- **File uploads:** Permission letters, certificates, geotagged photos, brochures per category
- **PDF generation:** Per-entry PDF reports via pdf-lib
- **Export pipeline:** Schema-driven CSV/XLSX export for admin
- **Admin panel:** Confirmation management, faculty directory, data export
- **Google OAuth:** NextAuth v4 with `@tce.edu` domain restriction and faculty directory lookup
- **File-based storage:** JSON stores with atomic writes, per-user locking, write-ahead log

### Infrastructure

- Rate limiting on entry creation and file upload routes
- Loading skeletons for dashboard, data-entry, and admin pages
- Parallelized category file reads in index and dashboard computation
- Eliminated redundant streak rebuild in entry mutation path
- GitHub Actions CI pipeline (build + test)
- Authentication on all API routes, admin guards on mutation endpoints
- `.env.example` for onboarding

### Documentation

- ARCHITECTURE.md — canonical ownership rules and anti-drift policy
- DESIGN_SYSTEM.md — UI/UX patterns, color system, component specs
- CONTRIBUTING.md — branch workflow, commit conventions, PR checklist
- DATA_MODEL.md — file-based storage structure and formats
- API.md — all API endpoints with auth and rate-limit status
- AUDIT.md — security and architecture audit with phased action plan
- CLAUDE.md — AI assistant guidance

---

## Template for Future Entries

```markdown
## [X.Y.Z] - YYYY-MM-DD

Brief summary of the release.

### Added
- New features

### Changed
- Changes to existing functionality

### Fixed
- Bug fixes

### Removed
- Removed features

### Security
- Security-related changes
```
