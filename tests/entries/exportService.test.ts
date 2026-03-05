import assert from "node:assert/strict";
import test from "node:test";
import { DataStore } from "../../lib/dataStore.ts";
import {
  buildExportRows,
  generateCsvText,
  generateXlsxBuffer,
} from "../../lib/export/exportService.ts";
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
  });
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
