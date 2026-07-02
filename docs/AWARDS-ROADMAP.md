# Faculty Awards — Build Roadmap

> The award FOUNDATION shipped 2026-07: rulebook registry
> (`data/awardMetrics.ts`), admin-adjustable points (`lib/awards/config.ts` +
> `/api/admin/awards/points`), scoring engine (`lib/awards/scoring.ts`),
> self/admin APIs, and the dashboard "My Award Progress" panel. This document
> is the ORDERED plan for everything that builds on it — one slice at a time.
> Field specs come from the official submission format ("INDIVIDUAL FACULTY
> AWARDS-format-2026", 18 tables) and the department's Academic Data workbook.

## How a new award-feeding category is built (recipe)

1. `./scripts/add-category.sh <slug> "<Label>"` and follow its checklist.
2. Schema fields per the spec below (two-stage model; `collaborates: true`
   on co-author/co-coordinator faculty-row fields so copies fan out).
3. Wire the metric: set `source: "entry"` + `categories` on the metric in
   `data/awardMetrics.ts`, add a deriver in `lib/awards/scoring.ts`, add a
   scoring test. The dashboard picks it up automatically.
4. Gates, commit. (Pre-Ship Checklist in CLAUDE.md applies.)

## Phase A — highest points, cleanest data (build in this order)

1. **journal-publications** (feeds `conference_publication` sibling + NAAC)
   — form T7 + Excel "R&D - Journals" sheet. Stage 1: title, authors
   (faculty-rows, `collaborates: true`, first-four-claim note), journalName,
   ISSN, volume/issue, pageNumbers, monthYear, scopusIndexed (Yes/No),
   doi. Stage 2: first page upload, index proof. Metric: per-unit 5 (Scopus
   conference/publication rules).
2. **books-and-chapters** (feeds `book_publication` 10 / `book_chapter` 5)
   — form T8/T9. One category, kind field Book|Chapter; authors
   collaborates; publisher, ISBN, monthYearEdition, chapterTitle (chapter
   only). Stage 2: cover/ISBN proof.
3. **patents** (feeds `utility_patent` granted 10 / published 5) — form
   T5/T6. status Published|Granted (tier key!), inventors collaborates,
   nationalOrInternational, applicationDate, publicationOrGrantDate.
   Stage 2: patent document.
4. **research-funding** (feeds `rd_funding` tiers by amount + `non_rd_funding`)
   — form T11/T12 + Excel "Research Grant". kind R&D|Other, investigators
   collaborates (PI/Co-PI role), title, agency, amountLakhs (drives tier),
   sanctionDate, period. Stage 2: sanction order. Deriver picks tier from
   amountLakhs.
5. **phd-milestones** (feeds `phd_awarded` 15 / `phd_guided` 12) — form
   T13/T14. kind AwardedToMe|GuidedScholar, thesisTitle, candidateName
   (guided), guideName (awarded), vivaDate (THE date that counts).
   Stage 2: viva/award proof.
6. **conferences-organized** (feeds `intl/natl_conference_organized`,
   SHARED 50/30/20 by role) — form T15/T16. level National|International,
   title, role (coordinator|lead|member — drives share %), team
   collaborates with per-row role, dates, delegates, papersPresented.
   Deriver: points × role share. Stage 2: event + committee proofs.
7. **editorial-roles** (feeds `editorial_role` 6) — form T10. journalName,
   role, reviewDetails. Stage 2: appointment proof.

## Phase B — T'SEDA-specific creative outputs

8. **design-competitions** (feeds `design_competition` award 5 /
   participation 2) — level, result Award|Participation (tier), organizer,
   teamMembers collaborates. Stage 2: certificate.
9. **exhibitions-outreach** (feeds `public_exhibition` 2 max 4 +
   `open_reviews_exhibitions` 1 max 3) — kind Exhibition|OpenReview|Outreach,
   venue, dates, externalExperts. Stage 2: catalogue/invitation.
10. **creative-publications** (feeds `creative_publication` 5/unit) —
    platform/magazine, ISSN if any, publication date. Stage 2: copy.
11. **online-courses** (feeds `tce_online_course` 10/15/20 by weeks +
    `industry_supported_course` 4/8 by credits) — kind, durationWeeks or
    credits (tier), newOrRerun, industryExpert (ISC). Stage 2: Dean-signed
    proofs.

## Phase C — admin & workflow surfaces

12. **Admin points editor UI** — consumes `/api/admin/awards/points`
    (GET/PUT exist). A table per section: default vs effective, inline edit,
    reset-to-default. Settings-gated.
13. **Admin faculty scores view** — consumes `/api/admin/awards?email=`;
    per-faculty year picker inside the admin console (needed to run the
    award). NO peer-visible leaderboard (privacy decision, 2026-07).
14. **Interview/committee metrics entry** — small admin form writing
    committee-awarded points (studio focus 5, documentation 3, beyond
    syllabus 5, student feedback tier) into a per-faculty-per-year store the
    scoring engine merges (`source: "interview"` metrics stop being 0).
15. **One-click Faculty Award Appraisal report** — button on the dashboard
    panel → `/api/me/awards/report?year=` generates the OFFICIAL 18-table
    submission format as .docx, each table filled from the faculty's
    committed entries (fields map 1:1 per the specs above), score summary
    appended, signature blocks left blank. Implementation: `docx` npm
    package server-side (pdf-lib is PDF-only); stream as download. Faculty
    get a submission-ready document instead of a weekend of form-filling.

## Field additions to EXISTING categories (small, anytime)

- `fdp-conducted` + `workshops`: `outsideParticipants` (number, stage 2) —
  the award rule requires "> 20 OUTSIDE participants"; today the deriver
  uses `numberOfParticipants` as a proxy and says so in its notes.
- `guest-lectures`: `speakerAffiliationType` (Industry|Academic) — not
  points-relevant today (tiers are identical) but matches the Excel sheet
  and future-proofs the S2 split.

## Not award-scoring (by design — keep as records)

`fdp-attended` and `case-studies` feed NAAC/COA reporting and the streak
system, not award points (attending isn't rewarded by the scheme). The
dashboard's coverage note reflects only scoring metrics.
