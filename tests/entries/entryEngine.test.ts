import assert from "node:assert/strict";
import test from "node:test";
import {
  approveEntry,
  commitDraft,
  createEntry,
  deleteEntry,
  getEntryWorkflowStatus,
  isLockedFromApproval,
  listEntriesForCategory,
  rejectEntry,
  sendForConfirmation,
  updateEntry,
} from "../../lib/entryEngine.ts";
import { readEvents } from "../../lib/data/wal.ts";
import { SECURITY_LIMITS } from "../../lib/security/limits.ts";
import type { CategoryKey } from "../../lib/entries/types.ts";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";

const category: CategoryKey = "workshops";
const ownerEmail = "faculty.engine@tce.edu";
const adminEmail = "senarch@tce.edu";

function buildUploadedFile(seed: string) {
  return {
    fileName: `${seed}.pdf`,
    mimeType: "application/pdf",
    size: 100,
    uploadedAt: new Date().toISOString(),
    url: `/uploads/${seed}.pdf`,
    storedPath: `${seed}.pdf`,
  };
}

function buildCompleteWorkshopPayload() {
  return {
    academicYear: "Academic Year 2025-2026",
    semesterType: "Odd",
    startDate: "2025-08-10",
    endDate: "2025-08-12",
    eventName: "Commit Ready Workshop",
    speakerName: "Speaker",
    organisationName: "TCE",
    uploads: {
      permissionLetter: buildUploadedFile("permission"),
      brochure: buildUploadedFile("brochure"),
      attendance: buildUploadedFile("attendance"),
      organiserProfile: buildUploadedFile("organiser-profile"),
      geotaggedPhotos: [buildUploadedFile("photo-1")],
    },
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

test("createEntry stores entry in DRAFT workflow state", async () => {
  await withSandbox("entry-engine-create", async () => {
    const created = await createEntry(ownerEmail, category, {
      eventName: "Intro Workshop",
    });

    assert.ok(typeof created.id === "string" && created.id.length > 0);
    assert.equal(getEntryWorkflowStatus(created), "DRAFT");

    const list = await listEntriesForCategory(ownerEmail, category);
    assert.equal(list.length, 1);
    assert.equal(String(list[0]?.id ?? ""), String(created.id));
  });
});

test("entryEngine normalizes payload values on create and update", async () => {
  await withSandbox("entry-engine-normalize", async () => {
    const created = await createEntry(ownerEmail, category, {
      eventName: "  Normalize Workshop  ",
      speakerName: "   ",
      startDate: "2026-03-10T09:00:00.000Z",
    });

    assert.equal(String(created.eventName ?? ""), "Normalize Workshop");
    assert.equal(created.speakerName, null);
    assert.equal(String(created.startDate ?? ""), "2026-03-10");
    assert.deepEqual(created.attachments, []);

    const updated = await updateEntry(ownerEmail, category, String(created.id), {
      eventName: "\n Updated Workshop ",
      organisationName: "   ",
      endDate: new Date("2026-03-12T12:00:00.000Z"),
    });

    assert.equal(String(updated.eventName ?? ""), "Updated Workshop");
    assert.equal(updated.organisationName, null);
    assert.equal(String(updated.endDate ?? ""), "2026-03-12");
    assert.deepEqual(updated.attachments, []);
  });
});

test("entryEngine strips unknown keys on create and update", async () => {
  await withSandbox("entry-engine-sanitize-unknown", async () => {
    const created = await createEntry(ownerEmail, category, {
      eventName: "Sanitized Workshop",
      unsafeKey: "drop-me",
      nestedUnsafe: {
        a: 1,
      },
    });

    assert.equal(created.unsafeKey, undefined);
    assert.equal(created.nestedUnsafe, undefined);

    const updated = await updateEntry(ownerEmail, category, String(created.id), {
      speakerName: "Known field",
      randomFlag: true,
      status: "final",
    });

    assert.equal(updated.randomFlag, undefined);
    assert.equal(String(updated.status ?? ""), "draft");
  });
});

test("entryEngine rejects invalid enum values server-side", async () => {
  await withSandbox("entry-engine-enum-validation", async () => {
    await assert.rejects(
      () =>
        createEntry(ownerEmail, category, {
          eventName: "Invalid enum workshop",
          semesterType: "Summer",
        }),
      /Semester Type has an invalid value/
    );
  });
});

test("entryEngine rejects overlong string values server-side", async () => {
  await withSandbox("entry-engine-max-length", async () => {
    await assert.rejects(
      () =>
        createEntry(ownerEmail, category, {
          eventName: "x".repeat(SECURITY_LIMITS.entryMaxStringLength + 1),
        }),
      /exceeds 5000 characters/
    );
  });
});

test("sendForConfirmation then approve moves to APPROVED and locks entry", async () => {
  await withSandbox("entry-engine-approve", async () => {
    const created = await createEntry(ownerEmail, category, {
      ...buildCompleteWorkshopPayload(),
      eventName: "Approval Workshop",
    });
    const committed = await commitDraft(ownerEmail, category, String(created.id));
    assert.equal(String(committed.status), "final");

    const pending = await sendForConfirmation(ownerEmail, category, String(committed.id));
    assert.equal(getEntryWorkflowStatus(pending), "PENDING_CONFIRMATION");

    const approved = await approveEntry(
      adminEmail,
      category,
      ownerEmail,
      String(created.id)
    );
    assert.equal(getEntryWorkflowStatus(approved), "APPROVED");
    assert.equal(isLockedFromApproval(approved), true);
  });
});

test("rejectEntry moves pending entries to REJECTED and keeps them editable", async () => {
  await withSandbox("entry-engine-reject", async () => {
    const created = await createEntry(ownerEmail, category, {
      ...buildCompleteWorkshopPayload(),
      eventName: "Reject Workshop",
    });

    await commitDraft(ownerEmail, category, String(created.id));
    await sendForConfirmation(ownerEmail, category, String(created.id));
    const rejected = await rejectEntry(
      adminEmail,
      category,
      ownerEmail,
      String(created.id),
      "Need corrections"
    );

    assert.equal(getEntryWorkflowStatus(rejected), "REJECTED");
    assert.equal(isLockedFromApproval(rejected), false);
  });
});

test("deleteEntry removes persisted records", async () => {
  await withSandbox("entry-engine-delete", async () => {
    const created = await createEntry(ownerEmail, category, {
      eventName: "Delete Workshop",
    });

    const removed = await deleteEntry(ownerEmail, category, String(created.id));
    assert.ok(removed);

    const list = await listEntriesForCategory(ownerEmail, category);
    assert.equal(list.length, 0);
  });
});

test("pending entries reject immutable core field updates", async () => {
  await withSandbox("entry-engine-pending-core-block", async () => {
    const created = await createEntry(ownerEmail, category, {
      ...buildCompleteWorkshopPayload(),
      eventName: "Pending Workshop",
    });
    await commitDraft(ownerEmail, category, String(created.id));
    await sendForConfirmation(ownerEmail, category, String(created.id));

    await assert.rejects(
      () =>
        updateEntry(ownerEmail, category, String(created.id), {
          eventName: "Changed While Pending",
        }),
      /Pending confirmation — core fields cannot be edited\./
    );
  });
});

test("pending entries allow attachment updates", async () => {
  await withSandbox("entry-engine-pending-upload-allow", async () => {
    const created = await createEntry(ownerEmail, category, {
      ...buildCompleteWorkshopPayload(),
      eventName: "Pending Workshop Upload",
    });
    await commitDraft(ownerEmail, category, String(created.id));
    await sendForConfirmation(ownerEmail, category, String(created.id));

    const updated = await updateEntry(ownerEmail, category, String(created.id), {
      uploads: {
        permissionLetter: {
          fileName: "permission.pdf",
          mimeType: "application/pdf",
          size: 100,
          uploadedAt: new Date().toISOString(),
          url: "/uploads/permission.pdf",
          storedPath: "permission.pdf",
        },
        brochure: null,
        attendance: null,
        organiserProfile: null,
        geotaggedPhotos: [],
      },
    });

    assert.equal(getEntryWorkflowStatus(updated), "PENDING_CONFIRMATION");
    assert.ok(updated.uploads);
  });
});

test("commitDraft blocks incomplete entries and sets status final when complete", async () => {
  await withSandbox("entry-engine-commit-draft", async () => {
    const incomplete = await createEntry(ownerEmail, category, {
      eventName: "Incomplete workshop",
    });

    await assert.rejects(
      () => commitDraft(ownerEmail, category, String(incomplete.id)),
      (error: unknown) => {
        const asRecord = error as { code?: string; details?: { fieldErrors?: Record<string, string> } };
        assert.equal(asRecord.code, "VALIDATION_ERROR");
        assert.ok(asRecord.details?.fieldErrors);
        assert.equal(typeof asRecord.details?.fieldErrors?.academicYear, "string");
        return true;
      }
    );

    const complete = await createEntry(ownerEmail, category, buildCompleteWorkshopPayload());
    const committed = await commitDraft(ownerEmail, category, String(complete.id));
    assert.equal(String(committed.status), "final");
    assert.equal(getEntryWorkflowStatus(committed), "DRAFT");
  });
});

test("concurrent updates are serialized without lost writes", async () => {
  await withSandbox("entry-engine-concurrent-updates", async () => {
    const created = await createEntry(ownerEmail, category, {
      eventName: "Concurrent Workshop",
    });

    const entryId = String(created.id);
    await Promise.all([
      updateEntry(ownerEmail, category, entryId, {
        speakerName: "Speaker A",
      }),
      updateEntry(ownerEmail, category, entryId, {
        organisationName: "TCE Concurrent Org",
      }),
    ]);

    const list = await listEntriesForCategory(ownerEmail, category);
    assert.equal(list.length, 1);
    assert.equal(String(list[0]?.id ?? ""), entryId);
    assert.equal(String(list[0]?.speakerName ?? ""), "Speaker A");
    assert.equal(String(list[0]?.organisationName ?? ""), "TCE Concurrent Org");

    const eventsResult = await readEvents(ownerEmail);
    assert.equal(eventsResult.ok, true);
    if (!eventsResult.ok) return;
    const matching = eventsResult.data.filter((event) => event.entryId === entryId);
    assert.ok(matching.length >= 3);
  });
});
