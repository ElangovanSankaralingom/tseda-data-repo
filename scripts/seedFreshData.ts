/**
 * SEED FRESH DATA — clear all user data and employ new data in ALL
 * categories through the REAL engine paths, then verify the wiring end to
 * end (Elan's ruling, 2026-07).
 *
 * Run (dev server stopped):
 *   npm run seed:fresh    — wipe + seed + verify
 *   npm run data:clear    — wipe ONLY (no new data)
 *
 * What it does:
 *   1. WIPES user trees + every derived store (feed, analytics cache,
 *      action history, export history, entry uploads, quarantine trash).
 *      Admin config (faculty registry, roles, settings, award points)
 *      is KEPT — clearing it would lock people out.
 *   2. SEEDS entries in all 22 categories via createEntry →
 *      generateAndPersistEntryPdf (real PDFs for permission flow, real
 *      commits for record flow), so index/summary/feed/streak wiring
 *      fires exactly as in production. Archetypes: past-dated committed
 *      (wall "logged"), future-dated activated (gold track running),
 *      stage-2-complete wins (gold), record commits (silver), one
 *      collaborative fan-out, one draft.
 *   3. RECONCILES (runSyncReconcile — the nightly backstop) and then
 *      VERIFIES: store counts vs index totals per category, store
 *      revision stamps, feed census by type, award score split.
 *      Exits non-zero if ANY surface disagrees.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ENTRY_SCHEMAS } from "../data/schemas/index.ts";
import { CATEGORY_LIST, getCategoryEntryScope, getCategoryFlow } from "../data/categoryRegistry.ts";
import type { CategoryKey } from "../lib/entries/types.ts";
import { createEntry, finalizeEntry } from "../lib/entries/lifecycle.ts";
import { addFaculty, getFacultyRecord } from "../lib/admin/facultyRegistry.ts";
import { generateAndPersistEntryPdf } from "../lib/pdf/pdfService.ts";
import { readCategoryEntries } from "../lib/dataStore.ts";
import { ensureUserIndex } from "../lib/data/indexStore.ts";
import { readStoreRevision } from "../lib/data/storeRevision.ts";
import { runSyncReconcile } from "../lib/jobs/syncReconcile.ts";
import { listFeedEvents } from "../lib/feed/feedStore.ts";
import { computeFacultyAwardScore } from "../lib/awards/scoring.ts";
import { getUsersRootDir, getDataRoot } from "../lib/userStore.ts";
import { privateDataRoot } from "../lib/config/storagePaths.ts";

const MASTER = "senarch@tce.edu";
const COLLEAGUES = ["priya.r@tce.edu", "karthik.m@tce.edu"];

const PAST = { academicYear: "Academic Year 2025-2026", semesterType: "EVEN", startDate: "2026-02-10", endDate: "2026-02-12" };
const FUTURE = { academicYear: "Academic Year 2026-2027", semesterType: "ODD", startDate: "2026-07-21", endDate: "2026-07-23" };

const TITLES: Partial<Record<CategoryKey, string[]>> = {
  "fdp-attended": ["Parametric Design Thinking FDP", "Climate-Responsive Architecture FDP"],
  "fdp-conducted": ["Digital Fabrication for Educators"],
  "case-studies": ["Chettinad Courtyard Houses Study"],
  "guest-lectures": ["Vernacular Materials in Contemporary Practice"],
  "workshops": ["Bamboo Construction Workshop"],
  "conferences-organized": ["National Seminar on Sustainable Habitats"],
  "design-competitions": ["CoA National Design Competition"],
  "exhibitions-outreach": ["Madurai Heritage Walk Exhibition"],
  "online-courses": ["TCE Online Course: BIM Fundamentals"],
  "mentoring-programs": ["Slow Learners Studio Mentoring"],
  "journal-publications": ["Thermal Comfort in Vernacular Dwellings", "Courtyards as Climate Devices"],
  "conference-publications": ["Mapping Temple Town Morphologies"],
  "books-and-chapters": ["Chapter: Tectonics of South Indian Brick"],
  "patents": ["Modular Ferrocement Roofing Panel"],
  "research-funding": ["Passive Cooling Retrofit Study"],
  "editorial-roles": ["Journal of Tropical Architecture"],
  "studio-contributions": ["Open Jury: Semester V Housing Studio"],
  "creative-publications": ["Sketch Series: Meenakshi Streetscapes"],
  "student-placements": ["Placement Record 2025-26"],
  "student-higher-studies": ["Higher Studies Record 2025-26"],
  "student-exams": ["NATA/GATE Qualifiers 2025-26"],
  "student-awards": ["Student Award Record 2025-26"],
};

const titleCursor: Record<string, number> = {};
function nextTitle(category: CategoryKey): string {
  const pool = TITLES[category] ?? [category];
  const i = (titleCursor[category] = (titleCursor[category] ?? 0) + 1);
  return pool[(i - 1) % pool.length] + (i > pool.length ? ` ${i}` : "");
}

function fileMeta(owner: string, category: string, entryId: string, name: string) {
  return [{
    storedPath: `uploads/${owner}/${category}/${entryId}/${name}`,
    url: `/api/entry-file?path=uploads/${owner}/${category}/${entryId}/${name}`,
    fileName: name,
    sizeBytes: 1024,
    uploadedAt: new Date().toISOString(),
  }];
}

/** Write a real dummy file so integrity scans never flag a missing upload. */
async function writeDummyUpload(owner: string, category: string, entryId: string, name: string) {
  const dir = path.join(privateDataRoot(), "entry-uploads", owner, category, entryId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), "%PDF-1.4\n% seeded proof document\n%%EOF\n", "utf8");
}

/**
 * Build a payload for a category straight from ITS SCHEMA — required
 * stage-1 fields always filled; stage-2 uploads filled when `withUploads`.
 * No hardcoded field lists: new categories seed themselves.
 */
async function buildPayload(
  owner: string,
  category: CategoryKey,
  period: typeof PAST,
  withUploads: boolean,
): Promise<Record<string, unknown>> {
  const id = randomUUID();
  const payload: Record<string, unknown> = { id };
  const title = nextTitle(category);

  // System/lifecycle fields the ENGINE owns — the seeder never touches them.
  const SYSTEM_KEYS = new Set([
    "pdfMeta", "pdfStale", "pdfSourceHash", "streak", "requestEditStatus",
    "requestEditRequestedAtISO", "requestEditMessage", "createdAt", "updatedAt",
  ]);

  for (const field of ENTRY_SCHEMAS[category].fields) {
    const key = field.key;
    const def = field as unknown as {
      key: string; kind?: string; required?: boolean; upload?: boolean; stage?: number;
      enumValues?: Array<string | number | boolean>; collaborates?: boolean;
      min?: number; max?: number;
    };
    if (SYSTEM_KEYS.has(key) || def.kind === "object") continue;

    if (def.upload) {
      if (withUploads) {
        const name = `${key}.pdf`;
        await writeDummyUpload(owner, category, id, name);
        payload[key] = fileMeta(owner, category, id, name);
      } else {
        payload[key] = [];
      }
      continue;
    }
    if (def.collaborates) { payload[key] = []; continue; }
    if (key === "academicYear") { payload[key] = period.academicYear; continue; }
    if (key === "semesterType") { payload[key] = period.semesterType; continue; }
    if (key === "startDate") { payload[key] = period.startDate; continue; }
    if (key === "endDate") { payload[key] = period.endDate; continue; }

    if (Array.isArray(def.enumValues) && def.enumValues.length > 0) {
      // Yes/No conditionals (sponsored, …): pick "No" so dependent fields
      // stay non-required; otherwise the first enum value.
      const no = def.enumValues.find((v) => typeof v === "string" && /^no$/i.test(v));
      payload[key] = no ?? def.enumValues[0];
    } else if (def.kind === "boolean") {
      payload[key] = false;
    } else if (def.kind === "number") {
      const kl = key.toLowerCase();
      // Semester numbers must agree with yearOfStudy ("1st year" → sem 1).
      const raw = kl.includes("semester") ? 1 : kl.includes("amount") ? 750000 : 45;
      const capped = typeof def.max === "number" ? Math.min(raw, def.max) : raw;
      payload[key] = typeof def.min === "number" ? Math.max(capped, def.min) : capped;
    } else if (def.kind === "date") {
      payload[key] = period.endDate;
    } else if (def.kind === "array") {
      payload[key] = [];
    } else {
      // Text-ish: title-bearing keys get the curated title, others realistic filler.
      const k = key.toLowerCase();
      payload[key] =
        k.includes("name") || k.includes("title") || k.includes("topic") ? title :
        k.includes("venue") || k.includes("place") || k.includes("organis") || k.includes("organiz") || k.includes("body") || k.includes("agency") || k.includes("journal") || k.includes("publisher") ? "Thiagarajar College of Engineering, Madurai" :
        k.includes("description") || k.includes("detail") || k.includes("abstract") || k.includes("remark") ? `${title} — seeded record for wiring verification.` :
        title;
    }
  }
  return payload;
}

type Archetype = "past-committed" | "future-activated" | "future-won" | "record-committed" | "draft";

type FacultyRow = { email: string; name: string; isLocked: true };
const row = (email: string, name: string): FacultyRow => ({ email, name, isLocked: true });

async function seedEntry(owner: string, category: CategoryKey, archetype: Archetype, collaborators?: FacultyRow[]) {
  const flow = getCategoryFlow(category);
  const period = archetype === "future-activated" || archetype === "future-won" ? FUTURE : PAST;
  const withUploads = archetype === "future-won" || archetype === "record-committed" || archetype === "past-committed";
  const payload = await buildPayload(owner, category, period, withUploads);

  // case-studies REQUIRES at least one locked accompanying-staff row
  // (relational check beyond the schema) — default a colleague in.
  const effectiveCollaborators =
    collaborators ?? (category === ("case-studies" as CategoryKey) ? [row(COLLEAGUES[0], "Priya R")] : undefined);
  if (effectiveCollaborators?.length) {
    const collabField = ENTRY_SCHEMAS[category].fields.find(
      (f) => (f as unknown as { collaborates?: boolean }).collaborates,
    );
    if (collabField) payload[collabField.key] = effectiveCollaborators;
  }

  const created = await createEntry(owner, category, payload as never);
  const entryId = String((created as Record<string, unknown>).id ?? payload.id);

  if (archetype !== "draft") {
    await generateAndPersistEntryPdf({ email: owner, category, entryId });
  }
  // GOLD wins require the full journey: generate → stage-2 complete →
  // FINALIZE (permission flow rule — finalized + fresh PDF = won).
  if (archetype === "future-won") {
    await finalizeEntry(owner, category, entryId);
  }
  return { entryId, flow };
}

async function wipe() {
  const publicRoot = path.join(process.cwd(), getDataRoot());
  const targets = [
    getUsersRootDir(),
    path.join(publicRoot, "feed"),
    path.join(publicRoot, "maintenance", "analytics-cache.json"),
    path.join(publicRoot, "admin", "action-history.json"),
    path.join(publicRoot, "maintenance", "export-history.json"),
    path.join(privateDataRoot(), "entry-uploads"),
    path.join(privateDataRoot(), "trash"),
  ];
  for (const target of targets) {
    await fs.rm(target, { recursive: true, force: true });
  }
  console.log("── wiped user data + derived stores (admin config kept)");
}

function fail(message: string): never {
  console.error(`✗ VERIFICATION FAILED: ${message}`);
  process.exit(1);
}

async function verifyUser(email: string) {
  const index = await ensureUserIndex(email);
  if (!index.ok) fail(`${email}: index unreadable`);
  const rev = await readStoreRevision(email);
  if (index.data.storeRev !== rev) fail(`${email}: index rev ${index.data.storeRev} != store rev ${rev}`);

  let total = 0;
  for (const category of CATEGORY_LIST) {
    const stored = (await readCategoryEntries(email, category)).length;
    const indexed = index.data.totalsByCategory[category] ?? 0;
    if (stored !== indexed) fail(`${email}/${category}: store ${stored} != index ${indexed}`);
    total += stored;
  }
  const streaks = index.data.streakSnapshot;
  console.log(
    `✓ ${email}: ${total} entries — index/store agree in all ${CATEGORY_LIST.length} categories · ` +
    `streaks: ${streaks.streakActivatedCount} running, ${streaks.streakGoldWinsCount} gold, ${streaks.streakSilverWinsCount} silver`,
  );
  return total;
}

async function main() {
  // ── WIPE-ONLY MODE (npm run data:clear): clear everything, seed nothing ──
  if (process.argv.includes("--wipe-only")) {
    console.log("═══ TSEDA data clear ═══");
    await wipe();
    const leftoverUsers = await fs.readdir(getUsersRootDir()).catch(() => [] as string[]);
    if (leftoverUsers.length > 0) {
      console.error(`✗ users directory not empty after wipe: ${leftoverUsers.join(", ")}`);
      process.exit(1);
    }
    if ((await listFeedEvents(50)).length > 0) {
      console.error("✗ feed not empty after wipe");
      process.exit(1);
    }
    console.log("✓ all user data cleared — entries, indexes, feed, uploads, trash, caches");
    console.log("  (admin config kept: registry, roles, settings, award points)");
    console.log("Start the app: every surface should show its empty state.");
    return;
  }

  console.log("═══ TSEDA fresh-data seed + wiring verification ═══");
  await wipe();

  // Fan-out targets must be ACTIVE registry faculty (engineShare guard) —
  // and registered names make the Department Pulse read properly.
  const ROSTER: Array<[string, string]> = [
    [MASTER, "Elangovan Sankaralingom"],
    [COLLEAGUES[0], "Priya Ramachandran"],
    [COLLEAGUES[1], "Karthik Meenakshisundaram"],
  ];
  for (const [email, name] of ROSTER) {
    if (!getFacultyRecord(email)) addFaculty(email, name, MASTER);
  }
  console.log("── faculty registry: seed roster ensured (registry otherwise untouched)");

  // ── SEED: master gets every category ──
  const faculty = CATEGORY_LIST.filter((c) => getCategoryEntryScope(c) !== "dlc");
  const dlc = CATEGORY_LIST.filter((c) => getCategoryEntryScope(c) === "dlc");
  const goldWinCategories = new Set<CategoryKey>(["fdp-attended", "guest-lectures"] as CategoryKey[]);

  for (const category of faculty) {
    const flow = getCategoryFlow(category);
    if (flow === "record") {
      await seedEntry(MASTER, category, "record-committed");
    } else {
      await seedEntry(MASTER, category, "past-committed");
      if (goldWinCategories.has(category)) {
        await seedEntry(MASTER, category, "future-won");
      } else if (category === "workshops") {
        // Collaborative fan-out: colleagues receive their own draft copies.
        await seedEntry(MASTER, category, "future-activated", [
          row(COLLEAGUES[0], "Priya R"),
          row(COLLEAGUES[1], "Karthik M"),
        ]);
      } else if (category === "fdp-conducted" || category === "online-courses") {
        await seedEntry(MASTER, category, "future-activated");
      }
    }
    console.log(`  seeded ${category}`);
  }
  // Second journal paper + one visible draft.
  await seedEntry(MASTER, "journal-publications" as CategoryKey, "record-committed");
  await seedEntry(MASTER, "case-studies" as CategoryKey, "draft");
  // DLC department sheets (visible only with the enterData coordinator power).
  for (const category of dlc) {
    await seedEntry(MASTER, category, "record-committed");
    console.log(`  seeded ${category} (dlc)`);
  }

  // ── Colleagues: enough activity for the Department Pulse ──
  for (const colleague of COLLEAGUES) {
    await seedEntry(colleague, "journal-publications" as CategoryKey, "record-committed");
    await seedEntry(colleague, "patents" as CategoryKey, "record-committed");
    await seedEntry(colleague, "guest-lectures" as CategoryKey, "past-committed");
  }
  console.log("── seeding complete");

  // ── CONVERGE: the nightly backstop makes all fire-and-forget emission deterministic ──
  const reconcile = await runSyncReconcile();
  console.log(`── reconcile: ${reconcile.usersSwept} users, ${reconcile.indexesRebuilt} indexes, ${reconcile.entriesReconciled} entries`);

  // ── VERIFY ──
  console.log("═══ wiring verification ═══");
  let grandTotal = 0;
  for (const email of [MASTER, ...COLLEAGUES]) grandTotal += await verifyUser(email);

  const events = await listFeedEvents(200);
  const census = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`✓ Department Pulse: ${events.length} events — ${JSON.stringify(census)}`);
  if (!census.entry_committed) fail("no entry_committed events on the wall");
  if (!census.streak_won) fail("no streak_won events on the wall");
  if (!census.streak_started) fail("no streak_started events on the wall");
  if (events.some((e) => e.categoryKey && dlc.includes(e.categoryKey as CategoryKey))) {
    fail("a DLC department record leaked onto the wall");
  }

  const score = await computeFacultyAwardScore(MASTER, PAST.academicYear);
  const scoredSections = score.sections.filter((s) => s.points > 0);
  console.log(`✓ Award score (${PAST.academicYear}): ${score.totalPoints} points across ${scoredSections.length} sections`);
  for (const section of scoredSections) console.log(`    ${section.label}: ${section.points}`);
  if (score.totalPoints <= 0) fail("award engine scored zero for seeded committed entries");

  // Fan-out check: colleagues must hold their shared workshop draft copies.
  for (const colleague of COLLEAGUES) {
    const copies = (await readCategoryEntries(colleague, "workshops" as CategoryKey)) as Array<Record<string, unknown>>;
    if (!copies.some((c) => String(c.sourceEmail ?? "") === MASTER)) {
      fail(`${colleague}: collaborative fan-out copy missing`);
    }
  }
  console.log("✓ Collaborative fan-out: both colleagues hold their prefilled draft copies");

  console.log(`═══ ALL WIRING VERIFIED — ${grandTotal} entries seeded across ${CATEGORY_LIST.length} categories ═══`);
  console.log("Start the app and check: dashboard hero + analytics strip + award panel + bento + Department Pulse.");
  console.log("Note: the 4 department sheets are DLC-scoped — assign yourself the enterData power on /admin/coordinators to see them.");
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
