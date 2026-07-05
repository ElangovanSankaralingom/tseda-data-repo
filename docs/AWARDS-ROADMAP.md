# Faculty Awards — Build Roadmap

> The award FOUNDATION shipped 2026-07: rulebook registry
> (`data/awardMetrics.ts`), admin-adjustable points (`lib/awards/config.ts` +
> `/api/admin/awards/points`), scoring engine (`lib/awards/scoring.ts`),
> self/admin APIs, and the dashboard "My Award Progress" panel. This document
> is the ORDERED plan for everything that builds on it — one slice at a time.
> Field specs come from the official submission format ("INDIVIDUAL FACULTY
> AWARDS-format-2026", 18 tables) and the department's Academic Data workbook.
>
> **FLOW ASSIGNMENTS (Elan's ruling, 2026-07):** every item below is tagged
> [PERMISSION] (prior approval → permission PDF → timer → finalise) or
> [RECORD] (post-facto: data + proofs → submit → locked, streak immediate,
> DLC/admin-approved corrections; machinery + journal-publications shipped).
> The ruling by section: S1 → small descriptive box + proof upload (RECORD);
> S3 → student feedback is year+semester+percentage data entry, while
> mentoring / industry-supported / TCE-online need PERMISSION; S4 → all
> PERMISSION with complete data; S5 → RECORD, and these are the SPECIALLY
> COLLABORATIVE ones (fan-out on every author field is non-negotiable);
> S6 → RECORD ("data enter alone"); S7 → Ph.D. milestones move into the
> PROFILE/account section, conferences organized are PERMISSION.
> EVERY category carries the export-filter spine: required academicYear +
> ODD/EVEN semesterType.

## How a new award-feeding category is built (recipe)

1. `./scripts/add-category.sh <slug> "<Label>"` and follow its checklist.
2. Set `flow: "record"` in the registry entry for record categories (see
   CLAUDE.md "Two Lifecycle Flows"); permission is the default.
3. Schema fields per the spec below — ALWAYS including required
   `academicYear` + `semesterType`; `collaborates: true` on co-author/
   co-coordinator faculty-row fields so copies fan out.
4. Wire the metric: set `source: "entry"` + `categories` on the metric in
   `data/awardMetrics.ts`, add a deriver in `lib/awards/scoring.ts`, add a
   scoring test. The dashboard picks it up automatically.
5. Gates, commit. (Pre-Ship Checklist in CLAUDE.md applies.)

## Phase A — highest points, cleanest data (build in this order)

1. ~~**journal-publications**~~ ✅ SHIPPED 2026-07 [RECORD] — the reference
   record-flow category. Fields: academicYear, semesterType, paperTitle,
   journalName, ISSN, volume/issue, pageNumbers, publicationDate, DOI,
   indexing (Scopus/WoS/UGC-CARE/Other), coAuthors (`collaborates: true`),
   externalAuthors; proofs: first page (required), index proof. Metric:
   `journal_publication` 5/unit, auto-tracked.
2. **conference-publications** [RECORD, collaborative] (feeds
   `conference_publication` 5/unit) — workbook conference block. Title,
   authors collaborates, conference name, ISSN, national/international,
   month-year. Proofs: first page. S5 rule: fan-out on authors is essential.
3. **books-and-chapters** [RECORD, collaborative] (feeds `book_publication`
   10 / `book_chapter` 5) — form T8/T9. One category, kind Book|Chapter;
   authors collaborates; publisher, ISBN, monthYearEdition, chapterTitle
   (chapter only). Proofs: cover/ISBN.
4. **patents** [RECORD] (feeds `utility_patent` granted 10 / published 5)
   — form T5/T6. status Published|Granted (tier key!), inventors
   collaborates, nationalOrInternational, applicationDate,
   publicationOrGrantDate. Proofs: patent document.
5. **research-funding** [RECORD — "data enter alone"] (feeds `rd_funding`
   tiers + `non_rd_funding`; consultancy folds in as kind) — form T11/T12 +
   Excel "Research Grant"/"Consultancy". kind R&D|Consultancy|Other,
   investigators collaborates (PI/Co-PI role), title, agency/client,
   amountLakhs (drives tier), sanctionDate, period. Proofs: sanction order /
   work order / receipts.
6. **conferences-organized** [PERMISSION] (feeds `intl/natl_conference_organized`,
   SHARED 50/30/20 by role) — form T15/T16. Prior-approval event: permission
   PDF → conduct → stage-2 proofs → finalise. level, title, role
   (coordinator|lead|member — drives share %), team collaborates with
   per-row role, dates, delegates, papersPresented. Deriver: points × share.
7. **editorial-roles** [RECORD] (feeds `editorial_role` 6) — form T10.
   journalName, role, reviewDetails. Proofs: appointment letter.

**Ph.D. milestones (`phd_awarded` 15 / `phd_guided` 12) → PROFILE, not a
category (Elan's ruling):** add a "Research" section to the profile/account
page — ownPhd {status, university, thesisTitle, vivaDate, proof} + guided
scholars list {scholar, thesis, vivaDate, proof} (mirrors the Research
Scholars sheet). Scoring reads the profile store via a `source: "profile"`
deriver. Corrections through the same DLC-request pattern.

## Phase B — T'SEDA-specific creative outputs

8. **studio-contributions** [RECORD, descriptive] (feeds
   `open_reviews_exhibitions` 1/unit max 3 + evidence for S1 interview
   items) — Elan's S1 lead: a small DESCRIPTIVE BOX ("what you did") +
   proof upload, per event. Fields: academicYear, semesterType, kind
   (OpenReview|Exhibition|StudioDocumentation|BeyondSyllabus), description
   (textarea), date, venue/externals; proofs: photos/report. Doubles as the
   evidence base the committee reads for S1 interview scores.
9. **design-competitions** [PERMISSION] (feeds `design_competition` award 5
   / participation 2) — prior approval to participate; complete data
   mandatory. level, competition, organizer, result Award|Participation
   (tier), teamMembers collaborates. Stage 2: certificate.
10. **exhibitions-outreach** [PERMISSION] (feeds `public_exhibition` 2 max
    4) — public/outreach events need prior approval. kind
    Exhibition|Outreach, venue, dates, externalExperts. Stage 2:
    catalogue/invitation/report.
11. **creative-publications** [RECORD] (feeds `creative_publication` 5/unit)
    — platform/magazine, ISSN if any, publication date. Proofs: copy.
12. **online-courses** [PERMISSION] (feeds `tce_online_course` 10/15/20 by
    weeks + `industry_supported_course` 4/8 by credits) — course development
    needs prior approval (Dean-signed). kind, durationWeeks or credits
    (tier), newOrRerun, industryExpert (ISC). Stage 2: Dean-signed proofs.
13. **mentoring-programs** [PERMISSION] (feeds `fast_slow_learners` 5) —
    fast/slow-learner programs (workbook Qn 6–7): event name, targetGroup
    Fast|Slow, date, student list. Stage 2: proofs. Prior-approval flow per
    Elan's S3 ruling.

## S3 — Student feedback (claim, not a category)

Per Elan: faculty select academic year + semester and enter the feedback
PERCENTAGE (odd + even averaged, labs excluded). Small self-entry surface
(dashboard panel or profile) writing to a per-faculty-per-year claim store;
`student_feedback` scores its ≥90→10 / 80–90→5 tier from the average.
Admin/DLC can verify (the value is auditable against CAMU reports).

## Phase C — admin & workflow surfaces

14. **Admin points editor UI** — consumes `/api/admin/awards/points`
    (GET/PUT exist). A table per section: default vs effective, inline edit,
    reset-to-default. Settings-gated.
15. **Admin faculty scores view** — consumes `/api/admin/awards?email=`;
    per-faculty year picker inside the admin console (needed to run the
    award). NO peer-visible leaderboard (privacy decision, 2026-07).
16. **Interview/committee metrics entry** — small admin form writing
    committee-awarded points (studio focus 5, documentation 3, beyond
    syllabus 5) into a per-faculty-per-year store the scoring engine merges
    (`source: "interview"` metrics stop being 0). Reads
    studio-contributions (#8) as its evidence base.
17. **One-click Faculty Award Appraisal report** — button on the dashboard
    panel → `/api/me/awards/report?year=` generates the OFFICIAL 18-table
    submission format as .docx, each table filled from the faculty's
    committed entries (fields map 1:1 per the specs above), score summary
    appended, signature blocks left blank. Implementation: `docx` npm
    package server-side (pdf-lib is PDF-only); stream as download.

## B1/B2/B3 — department data beyond the award (Elan's ruling)

- **B1 overlaps:** category fields above are supersets of the workbook
  sheets they replace — exports must be able to reproduce each NAAC sheet
  (journals, chapters, conferences, grants, consultancy, memberships) via
  the export system's category+field filters (academicYear + semesterType
  spine required everywhere for exactly this reason).
- **B2 student data → DLC-entered module:** placements, higher studies,
  competitive exams, learners programs, student awards are keyed by STUDENT
  reg no, not faculty work. Build later as a DLC-scoped admin module (each
  sheet's DLC owner enters/imports their sheet), not per-faculty entry.
- **B3 course records → merge into existing categories where they overlap**
  (Elan's example: the case-studies category already covers the site-visit
  sheet). Course plans/feedback/BoS stay admin/DLC territory; merge, don't
  duplicate.

## Field additions to EXISTING categories (small, anytime)

- `fdp-conducted` + `workshops`: `outsideParticipants` (number, stage 2) —
  the award rule requires "> 20 OUTSIDE participants"; today the deriver
  uses `numberOfParticipants` as a proxy and says so in its notes.
- `guest-lectures`: `speakerAffiliationType` (Industry|Academic) — not
  points-relevant today (tiers are identical) but matches the Excel sheet
  and future-proofs the S2 split.
- DONE 2026-07: `semesterType` added to case-studies (export-filter spine).

## Not award-scoring (by design — keep as records)

`fdp-attended` and `case-studies` feed NAAC/COA reporting and the streak
system, not award points (attending isn't rewarded by the scheme). The
dashboard's coverage note reflects only scoring metrics.
