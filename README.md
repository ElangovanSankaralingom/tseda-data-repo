# TSEDA -- Faculty Data Collection App

Gamified professional development data collection system for TCE (Thiagarajar College of Engineering), Madurai.

Faculty members log activities across 5 categories: FDPs attended, FDPs conducted, guest lectures, case studies, and workshops. A streak system encourages timely submissions.

## Tech Stack
- Next.js 16 (App Router)
- React 19, TypeScript 5
- Tailwind CSS 4, shadcn/ui, lucide-react
- NextAuth.js 4 (Google OAuth, @tce.edu domain)
- File-based JSON storage (no database)
- pdf-lib for PDF generation

## Setup
1. Clone the repo
2. Copy .env.example to .env.local and fill in credentials
3. npm install
4. npm run dev
5. Open http://localhost:3000

## Commands
- npm run dev -- development server
- npm run build -- production build
- npm run lint -- lint check
- npm test -- run tests

## Documentation
- CLAUDE.md -- AI assistant guidance (master index)
- ARCHITECTURE.md -- canonical ownership rules
- DESIGN_SYSTEMS.md -- UI/UX style guide
- DATA_MODEL.md -- file storage structure
- API.md -- API endpoint reference
- STREAK-SPECIFICATION.md -- streak system rules
- PROMPT-ENGINEERING-FRAMEWORK.md -- prompt standards for Claude Code
- AUDIT.md -- security & architecture audit
- CONTRIBUTING.md -- contribution guidelines
- CHANGELOG.md -- version history
