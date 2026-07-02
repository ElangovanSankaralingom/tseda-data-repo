import assert from "node:assert/strict";
import test from "node:test";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import { createEntry, commitDraft, listEntriesForCategory } from "../../lib/entries/lifecycle.ts";
import { shareEntryWithCollaborators } from "../../lib/entries/internal/engineShare.ts";
import { addFaculty } from "../../lib/admin/facultyRegistry.ts";
import { hashPrePdfFields } from "../../lib/pdfSnapshot.ts";
import { addDaysISO, nowISTDateISO } from "../../lib/time.ts";

/**
 * Collaborative fan-out (engineShare): "when someone enters a data and adds
 * someone from the list, it's entered on both their places — each gets one
 * streak of their own."
 */

const OWNER = "owner.collab@tce.edu";
const COLLAB = "partner.collab@tce.edu";
const OUTSIDER = "outsider.collab@tce.edu"; // never added to the registry

function baseWorkshop(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const today = nowISTDateISO();
  return {
    academicYear: "2026-2027",
    semesterType: "ODD",
    level: "National",
    mode: "Offline",
    startDate: addDaysISO(today, 2),
    endDate: addDaysISO(today, 5), // future-dated → streak eligible at commit
    workshopName: "Collaborative Workshop",
    resourcePersonName: "Dr. Resource",
    resourcePersonDesignation: "Professor",
    resourcePersonOrganisation: "TCE",
    ...overrides,
  };
}

async function withSandbox<T>(label: string, run: () => Promise<T>): Promise<T> {
  const sandbox = await createTestDataRoot(label);
  try {
    return await run();
  } finally {
    sandbox.restore();
    await sandbox.cleanup();
  }
}

test("fan-out on generate: collaborator gets own prefilled DRAFT, outsider skipped, origin marked", async () => {
  await withSandbox("collab-fanout", async () => {
    addFaculty(COLLAB, "Partner Collab", OWNER);

    const created = await createEntry(OWNER, "workshops", baseWorkshop({
      coCoordinators: [
        { id: "r1", name: "Partner Collab", email: COLLAB },
        { id: "r2", name: "Outsider", email: OUTSIDER },
      ],
    }) as never);
    await commitDraft(OWNER, "workshops", String(created.id));

    const copies = await listEntriesForCategory(COLLAB, "workshops");
    assert.equal(copies.length, 1, "collaborator must receive exactly one copy");
    const copy = copies[0] as Record<string, unknown>;

    // Stage-1 data arrives prefilled; provenance recorded.
    assert.equal(copy.workshopName, "Collaborative Workshop");
    assert.equal(copy.sharedEntryId, String(created.id));
    assert.equal(copy.sourceEmail, OWNER);
    assert.equal(copy.sharedRole, "coCoordinators");
    assert.notEqual(String(copy.id), String(created.id), "copy must have its own id");

    // The copy is a fresh, independent DRAFT — no inherited lifecycle.
    assert.ok(!copy.committedAtISO, "copy must not be committed");
    assert.ok(!copy.editWindowExpiresAt, "copy must not have a running timer");
    const copyPdf = copy.pdfMeta as Record<string, unknown> | null | undefined;
    assert.ok(!copyPdf || !copyPdf.url, "copy must not carry the origin PDF");

    // Row swap: origin owner in, recipient out.
    const rows = copy.coCoordinators as Array<{ email: string }>;
    assert.ok(rows.some((r) => r.email === OWNER), "origin owner must appear in the copy's rows");
    assert.ok(!rows.some((r) => r.email === COLLAB), "recipient must not appear in their own rows");

    // Non-registry faculty receives nothing.
    assert.equal((await listEntriesForCategory(OUTSIDER, "workshops")).length, 0);

    // Origin records the fan-out.
    const origin = (await listEntriesForCategory(OWNER, "workshops"))[0] as Record<string, unknown>;
    assert.deepEqual(origin.sharedFanOutDone, [COLLAB]);
  });
});

test("loop guard + own streak: committing the copy never fans back, and earns its own eligibility", async () => {
  await withSandbox("collab-loop", async () => {
    addFaculty(COLLAB, "Partner Collab", OWNER);

    const created = await createEntry(OWNER, "workshops", baseWorkshop({
      coCoordinators: [{ id: "r1", name: "Partner Collab", email: COLLAB }],
    }) as never);
    await commitDraft(OWNER, "workshops", String(created.id));

    const copy = (await listEntriesForCategory(COLLAB, "workshops"))[0] as Record<string, unknown>;

    // The collaborator generates their own copy (their side of the record).
    const committedCopy = (await commitDraft(
      COLLAB,
      "workshops",
      String(copy.id),
    )) as Record<string, unknown>;

    // Each gets one streak of their own.
    assert.equal(committedCopy.streakEligible, true, "the copy must earn its own streak eligibility");

    // Loop guard: the copy names OWNER in its rows, but must NOT fan out back.
    const ownerEntries = await listEntriesForCategory(OWNER, "workshops");
    assert.equal(ownerEntries.length, 1, "origin owner must not receive a boomerang copy");
  });
});

test("duplicate guard: re-running fan-out never creates a second copy", async () => {
  await withSandbox("collab-dup", async () => {
    addFaculty(COLLAB, "Partner Collab", OWNER);

    const created = await createEntry(OWNER, "workshops", baseWorkshop({
      coCoordinators: [{ id: "r1", name: "Partner Collab", email: COLLAB }],
    }) as never);
    await commitDraft(OWNER, "workshops", String(created.id));

    const origin = (await listEntriesForCategory(OWNER, "workshops"))[0] as Record<string, unknown>;
    const rerun = await shareEntryWithCollaborators(OWNER, "workshops", origin as never);
    assert.equal(rerun.sharedWith.length, 0, "second fan-out must share with no one");

    assert.equal(
      (await listEntriesForCategory(COLLAB, "workshops")).length,
      1,
      "collaborator must still have exactly one copy",
    );
  });
});

test("provenance metadata never affects the PDF hash", () => {
  const entry = baseWorkshop();
  const withProvenance = {
    ...entry,
    sharedEntryId: "origin-123",
    sourceEmail: OWNER,
    sharedRole: "coCoordinators",
    sharedFanOutDone: [COLLAB],
  };
  assert.equal(
    hashPrePdfFields(entry, "workshops"),
    hashPrePdfFields(withProvenance, "workshops"),
    "collaboration metadata must be hash-neutral (no false 'Document outdated')",
  );
});
