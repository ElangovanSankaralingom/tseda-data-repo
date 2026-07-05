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
2. ~~**conference-publications**~~ ✅ SHIPPED 2026-07 [RECORD, collaborative]
   — feeds `conference_publication` 5/unit auto-tracked. Fields:
   academicYear, semesterType, paperTitle, conferenceName, level
   (National/International), organizedBy, publicationDate, ISSN/ISBN, DOI,
   pages, indexing, coAuthors (`collaborates: true`), externalAuthors;
   proofs: first page (required), proceedings/index proof.
3. ~~**books-and-chapters**~~ ✅ SHIPPED 2026-07 [RECORD, collaborative] —
   one category, `kind` Book|Chapter drives `book_publication` (10) vs
   `book_chapter` (5), both auto-tracked. Fields: academicYear,
   semesterType, kind, bookTitle, chapterTitle (required for chapters),
   publisher, ISBN, edition/volume, pages, publicationDate, coAuthors
   (`collaborates: true`), externalAuthors; proofs: cover/ISBN page
   (required), publication proof.
4. ~~**patents**~~ ✅ SHIPPED 2026-07 [RECORD] — `status` Published|Granted
   picks the tier (5/10, utility_patent auto-tracked). Fields: academicYear,
   semesterType, patentTitle, status, level, applicationNumber,
   applicationDate, statusDate, inventors (`collaborates: true`),
   externalInventors; proof: patent document (required).
5. ~~**research-funding**~~ ✅ SHIPPED 2026-07 [RECORD — "data enter alone"]
   — kind R&D|Consultancy|Other routes to `rd_funding` (amount tiers 5–25)
   or `non_rd_funding` (3/5), both auto-tracked from `amountInr`. Fields:
   academicYear, semesterType, kind, projectTitle, agencyOrClient,
   amountInr, sanctionDate, duration, investigators (`collaborates: true`),
   externalInvestigators; proofs: sanction/work order (required), receipts.
6. ~~**conferences-organized**~~ ✅ SHIPPED 2026-07 [PERMISSION] — the first
   NEW permission-flow category (letter → timer → stage-2 proofs →
   finalise). Role (Coordinator/Co-Coordinator/Committee Member) applies the
   50/30/20 share to intl 20 / natl 12, both auto-tracked. Team fan-out:
   each recipient sets THEIR OWN role before generating their letter.
   Stage 2: signed letter, event report, committee proof (required),
   photographs, delegates, papersPresented.
7. ~~**editorial-roles**~~ ✅ SHIPPED 2026-07 [RECORD, individual] — fixed 6
   awarded once per year for Editor / Associate Editor roles (auto-tracked);
   board memberships and reviewer roles recorded with an explanatory note.
   Fields: academicYear, semesterType, journalName, role, ISSN, publisher,
   appointmentDate, details; proof: appointment/invitation (required).

~~**Ph.D. milestones → PROFILE**~~ ✅ SHIPPED 2026-07 — "Research" tab on
the account page: own Ph.D. (status/university/thesis/supervisor/vivaDate)
+ guided scholars list, both with INTERNAL (TCE faculty, registry-picked —
creates a network edge) / EXTERNAL tagging per Elan's network ruling.
`phd_awarded` 15 and `phd_guided` 12/scholar score via the new
`source: "profile"` deriver, bucketed by each viva date's academic year
(July–June). The derived network panel shows faculty who tagged YOU as
supervisor (read-time join — no denormalised writes). Store is
universe-scoped (demo-safe). Future: department research-network admin view
joining both edge directions; proof uploads for viva certificates once
profile upload slots generalize.

## Phase B — T'SEDA-specific creative outputs

8. ~~**studio-contributions**~~ ✅ SHIPPED 2026-07 [RECORD, descriptive] —
   Elan's S1 lead exactly: contributionKind (Open Review / Jury |
   Exhibition of Student Work | Studio Documentation | Beyond Syllabus),
   activityTitle, descriptionText (the "what you did" TextArea), eventDate,
   venue, externalParticipants; required proofs upload. Open reviews +
   exhibitions auto-score `open_reviews_exhibitions` (1/unit CAP 3, deriver
   notes the cap); documentation/beyond-syllabus entries surface in score
   notes as the committee's interview evidence base. Field key is
   `contributionKind` (NOT `kind`) — the shared fields.kind label is
   "Publication Kind"; the same collision was silently mislabeling
   research-funding's selector and was fixed with a dedicated
   `fields.fundingKind` label in the same commit.
9. **design-competitions** [PERMISSION] (feeds `design_competition` award 5
   / participation 2) — prior approval to participate; complete data
   mandatory. level, competition, organizer, result Award|Participation
   (tier), teamMembers collaborates. Stage 2: certificate.
10. **exhibitions-outreach** [PERMISSION] (feeds `public_exhibition` 2 max
    4) — public/outreach events need prior approval. kind
    Exhibition|Outreach, venue, dates, externalExperts. Stage 2:
    catalogue/invitation/report.
11. ~~**creative-publications**~~ ✅ SHIPPED 2026-07 [RECORD, individual] —
    workTitle, publicationName (platform/magazine), publicationDate, ISSN
    optional, workUrl optional; required publicationCopy upload. Feeds
    `creative_publication` 5/unit (auto-tracked); appraisal prints the
    works table. Pink palette + Brush icon.
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

14. ~~**Admin points editor UI**~~ ✅ SHIPPED 2026-07 — `/admin/awards/points`
    (settings-gated, linked from the awards admin view via "Points Config"):
    section cards with per-metric inline editors — fixed/perUnit get one
    input, tiered models get one input per tier with the document default
    beside each — Overridden badge + Reset-to-default. Consumes the existing
    GET/PUT `/api/admin/awards/points`. Phase C complete: the award now runs
    end to end (scores → committee entry → points tuning → appraisal
    documents) from the admin console.
15. ~~**Admin faculty scores view**~~ ✅ SHIPPED 2026-07 — `/admin/awards`
    (registry card "Faculty Awards", gate = `canAccessAdminConsole`, same as
    the API): faculty picker → year picker → total + per-section cards with
    the FULL metric table (status chip, count, points, deriver notes — the
    self-view's insight chips are deliberately not enough to run the award)
    + admin download of any faculty's appraisal via the new
    `/api/admin/awards/report?email=&year=`. NO peer-visible leaderboard
    (privacy decision, 2026-07).
16. ~~**Interview/committee metrics entry**~~ ✅ SHIPPED 2026-07 — inline
    committee editors on the `/admin/awards` metric rows (settings-tier
    gate: entering committee scores changes outcomes exactly like editing
    point values, so it takes the SAME trust level as the points config;
    console-tier admins see scores read-only). Store:
    `lib/awards/interview.ts` at `<users>/<email>/interview-points.json`
    (universe-scoped → demo-safe), points clamped to the EFFECTIVE model
    max at write. Scoring merges `source: "interview"` awards (status
    manual, "Committee: <note>" in notes) → the appraisal document carries
    points + note automatically. API `/api/admin/awards/interview`
    (GET/PUT, CSRF, demoAware). Will read studio-contributions (#8) as its
    evidence base once that ships.
17. ~~**One-click Faculty Award Appraisal report**~~ ✅ SHIPPED 2026-07 —
    "Appraisal (.docx)" button on the My Award Progress panel →
    `/api/me/awards/report?year=` streams the submission document: score
    summary, one table per metric filled from the SAME committed entries +
    research profile the score reads (`listCommittedEntriesForYear` shared
    with the engine — no drift possible), Nil rows for empty metrics,
    committee/claim notes, blank signature blocks, DEMO stamp inside demo
    mode. Layout follows the T'SEDA seven sections; compare against the
    college's original 18-table form and tune table order if needed.

## B1/B2/B3 — department data beyond the award (Elan's ruling)

- **B1 overlaps:** category fields above are supersets of the workbook
  sheets they replace — exports must be able to reproduce each NAAC sheet
  (journals, chapters, conferences, grants, consultancy, memberships) via
  the export system's category+field filters (academicYear + semesterType
  spine required everywhere for exactly this reason).
- **B2 student data → DLC-ASSIGNED categories (Elan, 2026-07):** placements,
  higher studies, competitive exams, learners programs, student awards are
  keyed by STUDENT reg no — "one faculty has to enter those fields". Design:
  CategoryConfig gains `entryScope: "faculty" | "dlc"` — a dlc-scoped
  category is VISIBLE/ENTERABLE only to the faculty assigned to it (reuse
  the coordinators pattern: per-category entry-DLC assignment managed by the
  master admin, same as approval coordinators). DLC-scoped entries are
  department records: record flow, no streaks, no award points, full export
  support. Home page shows these under their own club only to the assigned
  DLC.
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
