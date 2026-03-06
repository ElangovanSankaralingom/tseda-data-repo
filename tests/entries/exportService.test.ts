import assert from "node:assert/strict";
import test from "node:test";
import { DataStore } from "../../lib/dataStore.ts";
import {
  buildExportRows,
  getExportCategoryOptions,
  getExportableFields,
  getExportStatusOptions,
  generateCsvText,
  generateXlsxBuffer,
} from "../../lib/export/exportService.ts";
import {
  ENTRY_STATUSES,
  ENTRY_STATUS_LABELS,
} from "../../lib/types/entry.ts";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";

const email = "faculty.export@tce.edu";

async function withSandbox<T>(label: string, run: (store: DataStore) => Promise<T>): Promise<T> {
  const sandbox = await createTestDataRoot(label);
  const store = new DataStore();
  try {
    return await run(store);
  } finally {
    sandbox.restore();
    await sandbox.cleanup();
  }
}

test("buildExportRows uses schema labels and normalized values", async () => {
  await withSandbox("export-service-labels", async (store) => {
    await store.writeCategory(email, "workshops", [
      {
        id: "entry-1",
        category: "workshops",
        eventName: "  Export Workshop  ",
        speakerName: "   ",
        startDate: "2026-05-10T11:30:00.000Z",
        confirmationStatus: "PENDING_CONFIRMATION",
        createdAt: "2026-05-10T00:00:00.000Z",
        updatedAt: "2026-05-11T00:00:00.000Z",
      },
    ]);

    const built = await buildExportRows(
      email,
      "workshops",
      ["id", "eventName", "speakerName", "startDate", "confirmationStatus"]
    );
    assert.equal(built.ok, true);
    if (!built.ok) return;

    assert.deepEqual(built.data.headers, [
      "Entry ID",
      "Event Name",
      "Speaker Name",
      "Start Date",
      "Confirmation Status",
    ]);
    assert.equal(built.data.rows.length, 1);
    assert.equal(String(built.data.rows[0]?.[1] ?? ""), "Export Workshop");
    assert.equal(String(built.data.rows[0]?.[2] ?? ""), "");
    assert.equal(String(built.data.rows[0]?.[3] ?? ""), "2026-05-10");
    assert.equal(String(built.data.rows[0]?.[4] ?? ""), "PENDING_CONFIRMATION");
    assert.equal(built.data.countsByStatus.PENDING_CONFIRMATION, 1);
    assert.equal(built.data.countsByStatus.DRAFT, 0);
  });
});

test("getExportableFields resolves schema-driven fields and excludes internal-only fields", () => {
  const fields = getExportableFields("workshops");
  const keys = new Set(fields.map((field) => field.key));

  assert.equal(keys.has("category"), true);
  assert.equal(keys.has("id"), true);
  assert.equal(keys.has("confirmationStatus"), true);
  assert.equal(keys.has("eventName"), true);

  assert.equal(keys.has("pdfMeta"), false);
  assert.equal(keys.has("streak"), false);
});

test("export status options use canonical status keys and labels", () => {
  const options = getExportStatusOptions();

  assert.deepEqual(
    options.map((option) => option.key),
    [...ENTRY_STATUSES]
  );
  assert.deepEqual(
    options.map((option) => option.label),
    ENTRY_STATUSES.map((status) => ENTRY_STATUS_LABELS[status])
  );
});

test("export category options are resolved from canonical category registry", () => {
  const options = getExportCategoryOptions();

  assert.equal(options[0]?.key, "all");
  assert.equal(options[0]?.label, "All Categories");
  assert.equal(options.length >= 2, true);
});

test("buildExportRows filters by status/date and generates csv/xlsx", async () => {
  await withSandbox("export-service-files", async (store) => {
    await store.writeCategory(email, "workshops", [
      {
        id: "approved-1",
        category: "workshops",
        eventName: "Approved Entry",
        confirmationStatus: "APPROVED",
        createdAt: "2026-03-01T10:00:00.000Z",
        updatedAt: "2026-03-05T10:00:00.000Z",
      },
      {
        id: "draft-1",
        category: "workshops",
        eventName: "Draft Entry",
        confirmationStatus: "DRAFT",
        createdAt: "2026-03-01T10:00:00.000Z",
        updatedAt: "2026-03-06T10:00:00.000Z",
      },
    ]);

    const built = await buildExportRows(
      email,
      "all",
      ["category", "id", "confirmationStatus", "updatedAt"],
      {
        statuses: ["APPROVED"],
        fromISO: "2026-03-01T00:00:00.000Z",
        toISO: "2026-03-31T23:59:59.999Z",
      }
    );
    assert.equal(built.ok, true);
    if (!built.ok) return;

    assert.equal(built.data.rows.length, 1);
    assert.equal(String(built.data.rows[0]?.[1] ?? ""), "approved-1");
    assert.equal(String(built.data.rows[0]?.[2] ?? ""), "APPROVED");
    assert.equal(built.data.countsByStatus.APPROVED, 1);
    assert.equal(built.data.countsByStatus.DRAFT, 0);

    const csv = generateCsvText(built.data.headers, built.data.rows);
    assert.equal(csv.ok, true);
    if (csv.ok) {
      assert.match(csv.data, /^Category,Entry ID,Confirmation Status,Updated At/m);
    }

    const xlsx = generateXlsxBuffer(built.data.headers, built.data.rows, "Export");
    assert.equal(xlsx.ok, true);
    if (xlsx.ok) {
      assert.equal(xlsx.data[0], 0x50);
      assert.equal(xlsx.data[1], 0x4b);
    }
  });
});

test("buildExportRows applies canonical status filtering even for legacy status fields", async () => {
  await withSandbox("export-service-status", async (store) => {
    await store.writeCategory(email, "workshops", [
      {
        id: "legacy-approved",
        category: "workshops",
        eventName: "Legacy Approved",
        status: "approved",
        createdAt: "2026-03-01T10:00:00.000Z",
        updatedAt: "2026-03-02T10:00:00.000Z",
      },
      {
        id: "legacy-draft",
        category: "workshops",
        eventName: "Legacy Draft",
        status: "draft",
        createdAt: "2026-03-01T10:00:00.000Z",
        updatedAt: "2026-03-02T10:00:00.000Z",
      },
    ]);

    const built = await buildExportRows(email, "workshops", ["id", "confirmationStatus"], {
      statuses: ["APPROVED"],
    });
    assert.equal(built.ok, true);
    if (!built.ok) return;

    assert.equal(built.data.rows.length, 1);
    assert.equal(String(built.data.rows[0]?.[0] ?? ""), "legacy-approved");
    assert.equal(String(built.data.rows[0]?.[1] ?? ""), "APPROVED");
    assert.equal(built.data.countsByStatus.APPROVED, 1);
  });
});
