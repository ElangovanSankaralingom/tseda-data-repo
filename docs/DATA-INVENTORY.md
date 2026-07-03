# Data Inventory — Award Parameters × Department Academic Data

> Decision sheet (2026-07). Column A of every decision: the T'SEDA award
> rulebook (`data/awardMetrics.ts`). Column B: what the department ALREADY
> collects by hand in "Academic Data 2025-2026.xlsx" (56 sheets, one per
> NAAC/COA question, each owned by a DLC faculty). Where the two overlap is
> where TSEDA categories pay for themselves twice: faculty enter once, the
> app feeds award scoring AND replaces a manual spreadsheet.

---

## A. Award parameters — the full rulebook

### S1 · Studio-Based Teaching and Course Innovation

| Metric | Points | Tracked via | Data needed |
|---|---|---|---|
| Achievement of Studio Focus Area | 5 | interview/committee | committee assessment; studio outputs |
| Studio Documentation and Curation | 3 | interview/committee | curated studio documentation |
| Open Reviews and Exhibitions | 1/event, max 3 | claim | event name, date, venue, invited externals, photos/report |
| Exploration Beyond Syllabus | 5 | interview/committee | evidence of beyond-syllabus work |

### S2 · Collaborative Teaching and External Engagement

| Metric | Points | Tracked via | Data needed |
|---|---|---|---|
| Collaborative Workshops | India 4 / Abroad 8 | **AUTO — `workshops`** | already captured |
| Guest Lectures | India 1 / Abroad 2 | **AUTO — `guest-lectures`** | already captured |

### S3 · Teaching Effectiveness and Student Development

| Metric | Points | Tracked via | Data needed |
|---|---|---|---|
| Student Feedback | ≥90% → 10; 80–90% → 5 | claim/admin | semester averages (odd+even, excl. labs) |
| Mentoring Fast/Slow Learners | 5 | claim | program names, dates, student lists, proofs |
| Industry-Supported Course | 1cr 4 / 2cr 8 | claim | course, credits, industry partner, Dean proof |
| TCE Online Course | 4w 10 / 8w 15 / 12w 20 | claim | course, weeks, new/rerun, Dean proof |

### S4 · Design-Based Research and Creative Outputs

| Metric | Points | Tracked via | Data needed |
|---|---|---|---|
| Design Competitions (non-NASA) | award 5 / participation 2 | claim | competition, organizer, result, team, certificate |
| Public Exhibitions / Outreach | 2/event, max 4 | claim | venue, dates, kind, catalogue/invitation |

### S5 · Scholarly Publications and Research Output

| Metric | Points | Tracked via | Data needed |
|---|---|---|---|
| Creative Publications & Writing | 5/unit | claim | platform/magazine, date, copy |
| Conference Publications (Scopus/reputed) | 5/unit | claim | title, authors, conference, ISSN, natl/intl, month-year, first page |
| Book Publication (ISBN) | 10/unit | claim | title, authors, publisher, ISBN, edition |
| Book Chapters / Editor (ISBN) | 5/unit | claim | book title, chapter title, authors, ISBN |
| Editor / Associate Editor (journals) | 6 | claim | journal, role, appointment proof |

### S6 · Grants, Consultancy, and Practice-Led Research

| Metric | Points | Tracked via | Data needed |
|---|---|---|---|
| Utility Patents | granted 10 / published 5 | claim | status, inventors, natl/intl, dates, patent doc |
| Funded/Sponsored R&D | <5L 5 · 5–10L 10 · 10–20L 15 · 20–50L 20 · ≥50L 25 | claim | project, agency, PI/Co-PI, amount, sanction order |
| Non-R&D Funding (govt/agencies) | <2.5L 3 / ≥2.5L 5 | claim | project, agency, amount — **consultancy revenue fits here** |

### S7 · Recognition, Mentorship, and Professional Contributions

| Metric | Points | Tracked via | Data needed |
|---|---|---|---|
| Ph.D. Awarded to Faculty | 15 | claim | thesis, guide, viva date, proof |
| Ph.D. Guided | 12/scholar | claim | scholar, thesis, viva date |
| International Conference Organized | 20 (50/30/20 role share) | claim | title, role, team, dates, delegates |
| National Conference Organized | 12 (50/30/20 role share) | claim | same |
| FDPs/Workshops/Training Conducted | ≤5d 8 / >5d 12 (>20 outside participants) | **AUTO — `fdp-conducted`** | needs `outsideParticipants` field |

**Today: 3 of ~25 metrics auto-score from entries.** Everything marked
"claim" is a candidate for a category below.

---

## B. What the department already collects (Academic Data 2025-2026.xlsx)

56 sheets, one per NAAC/COA question. Grouped by nature. Fields listed are
the ACTUAL column headers faculty fill by hand today.

### B1. Faculty-work sheets — overlap the award scheme directly

| Sheet | Fields collected | Award metric it feeds |
|---|---|---|
| **R&D – Journals** (Qn 19) | title of paper, authors, journal name, ISSN, vol/issue, page numbers, month-year, DOI, proof link, first page of paper | S5 publications |
| **Book Chapters** (Qn 20) | book title, authors, chapter title, ISBN, vol/issue, pages, month-year, proof, first page | S5 book chapter |
| **Conference papers** (same sheet) | paper title, authors, conference name, ISSN, **international/national**, pages, month-year, proof, first page | S5 conference publication |
| **Bibliometrics** (Qn 21) | Google Scholar / citation links | — (profile-level) |
| **Research Grants – Seed Money** (Qn 12) | project name, sponsoring agency, project coordinator, amount INR, income-expenditure statement | S6 R&D funding |
| **Fellowships** (Qn 13) | recipient, project, agency, amount, award letters | S6 funding |
| **Patents** (Qn 13 block) | (same grant-style block: name, agency, coordinator, amount, proofs) | S6 utility patents |
| **Consultancy** (Qn 24/56) | project, faculty involved, client, revenue generated, work order, client request letter, transaction receipts | S6 non-R&D funding |
| **FDP/Conference attended w/ support** (Qn 38–39) | duration (days), teacher name, PAN, program name, organizing body, professional-body membership, amount of support, dates, permission letter | records (fdp-attended exists); % teachers KPI |
| **Guest / Special Lectures** (Qn 11) | date, event name, speaker/organization, institution/industry, organisers, signed participant list, proof | S2 — **already a TSEDA category** |
| **Research Scholars** (Qn 17) | TCE roll no, univ reg no, scholar name, supervisor, internal/external, FT/PT, year of registration, email, current status (coursework→vivavoce), journal count, conference/chapter count, research title | S7 Ph.D. guided (pipeline view) |
| **Visiting Faculty** | name, designation, company, place, remuneration, studio assigned, review dates | dept record |
| **Professional Society Memberships** (Qn 25 block) | society name, institute membership Y/N, proof | S7-adjacent |
| **MoUs / Linkages** (Qn 25) | MoU name, dept, faculty involved, duration, purpose, year-wise activities, activity dates, MoU document | dept record |

### B2. Student-data sheets — NAAC/COA territory, not faculty awards

| Sheet | Fields collected |
|---|---|
| Fast learners (Qn 6) | event name, student, date, proof |
| Slow learners (Qn 7) | event name, student, date, proof |
| Placements (Qn 32) | reg no, student, office details, annual salary, offer proof |
| Higher studies (Qn 33) | reg no, student, institution, proof |
| Competitive exams (Qn 34) | reg no, student, qualifying exam, proof |
| Student awards (Qn 35) | NSS/NCC/YRC participation lists, proofs |
| Student publications (symposium) | student, institution/date, paper title, award won |
| Extension / outreach (Qn 26) | date, event, students participated, collaborating agency, organized by, awards, newspaper reports |
| Student counselling case studies | narrative case studies, proofs |
| NPTEL / one-credit courses (Qn 2) | course name, student, offering organization, proof |
| Nominal rolls / pass % / student-computer ratio | year, slot, counts, lab inventory, links |
| Career guidance programs (Qn 31) | date, event, speaker, participant count, proof |

### B3. Course & department records

| Sheet | Fields collected |
|---|---|
| Course changes / BoS (Qn 1) | course name, code, type of change, % change, new name/code, old + revised syllabus links, BoS minutes, Academic Council resolution, date |
| Course plans / design briefs / rubrics (Ql 3) | subject, approved plan links |
| Course feedback (Qn 4/16) | empty form link, filled form link |
| Course files / audits (Qn 18) | audit links |
| Case studies / site visits (Ql 3) | date, places of visit, purpose/interactions, **staff accompanying**, batch/year, amount of support, proofs — **already a TSEDA category** |
| Best sheets | subject name, code, TCS/S, proof |
| Dept association / WDC / SIG / class committee / 5S | date, event, type (sports/cultural/technical), invited experts, participant lists |
| Design expos & medals | date, location, purpose, proof |
| Alumni scholarship / contributions (Qn 29/37) | alumni name, batch, amount contributed, knowledge-sharing events |
| Infrastructure & equipment | lab name, computer counts, stock numbers, upgrade costs |
| ICT-enabled teaching (Ql 1) | subject, staff, semester, CAMU/Classroom/WhatsApp/form/LMS links, geo-tagged photos |
| Consolidated KPI sheets (×4) | per-question totals across B.Arch/B.Des/M.Plan, DLC owner, remarks |

---

## C. Candidates to take forward (pick from these)

Ordered by value: each row = one buildable category slice.

| # | Candidate category | Feeds award | Replaces manual sheet | Core fields (from form + workbook) |
|---|---|---|---|---|
| 1 | **journal-publications** | S5 (+NAAC Qn 19) | R&D – Journals | title, authors (collab), journal, ISSN, vol/issue, pages, month-year, DOI, Scopus Y/N; uploads: first page, index proof |
| 2 | **conference-publications** | S5 5/unit | Conference block | title, authors (collab), conference, ISSN, natl/intl, month-year; uploads: first page |
| 3 | **books-and-chapters** | S5 10 / 5 | Book Chapters | kind Book\|Chapter, titles, authors (collab), publisher, ISBN, month-year; uploads: cover/ISBN proof |
| 4 | **research-funding** (incl. consultancy) | S6 tiers + non-R&D | Seed money + Consultancy | kind R&D\|Consultancy\|Other, project, agency/client, investigators (collab, PI/Co-PI), amount, sanction date, period; uploads: sanction order / work order / receipts |
| 5 | **patents** | S6 10/5 | Patents block | status Published\|Granted, inventors (collab), natl/intl, application + grant dates; uploads: patent doc |
| 6 | **phd-milestones** | S7 15 / 12 | Research Scholars (award slice) | kind AwardedToMe\|GuidedScholar, scholar/guide, thesis title, viva date; uploads: proof |
| 7 | **conferences-organized** | S7 20/12 × role share | — (new) | level, title, role (drives 50/30/20), team (collab), dates, delegates; uploads: event + committee proofs |
| 8 | **editorial-roles** | S5 6 | — (new) | journal, role, review details; uploads: appointment |
| 9 | **design-competitions** | S4 5/2 | Design expos & medals | competition, organizer, result, team (collab); uploads: certificate |
| 10 | **exhibitions-outreach** | S1 + S4 per-unit | Extension/outreach (faculty slice) | kind Exhibition\|OpenReview\|Outreach, venue, dates, external experts; uploads: catalogue/report |
| 11 | **creative-publications** | S5 5/unit | — (new) | platform, title, date, ISSN if any; uploads: copy |
| 12 | **online-courses** | S3 tiers | NPTEL sheet (faculty slice) | kind TCE-online\|Industry-supported, weeks/credits, new/rerun, partner; uploads: Dean proof |
| 13 | **memberships-mous** (dept record) | S7-adjacent | Prof. societies + MoU sheets | society/MoU name, role, duration, activities; uploads: proof |
| 14 | **Field add-ons to existing categories** | S7 fdp_conducted accuracy | — | `outsideParticipants` on fdp-conducted + workshops; `amountOfSupport`+`fundingAgency` on fdp-attended (matches Qn 38 sheet) |
| 15 | **Student-data module** (separate track) | none — NAAC/COA | ALL of B2 (12 sheets) | per-student rows keyed by reg no: placements, higher studies, exams, awards, learners programs. Different data model (students, not faculty work) — decide separately |
| 16 | **Course-record module** (separate track) | none — COA/BoS | B3 course sheets | course plans, feedback links, BoS changes — likely DLC/admin-entered, not per-faculty |

### Recommendation

Rows **1–5 + 14** first: they are the award's biggest point pools, the
workbook proves the department already collects exactly these fields by
hand, and every one fits the existing two-stage + collaborates + fan-out
pattern with zero new machinery. Rows 6–12 follow one at a time. Rows 15–16
are worth building eventually but are a different shape (student-keyed /
admin-keyed, not faculty-entry) — schedule them as their own project phase
rather than mixing into the awards track.
