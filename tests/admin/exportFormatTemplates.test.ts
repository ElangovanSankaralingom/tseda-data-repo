import assert from "node:assert/strict";
import test from "node:test";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import { getAdminUsersConfig } from "../../lib/admin/roles.ts";
import { ROOT_MASTER_EMAIL } from "../../lib/admin.ts";
import { upsertCoordinatorType, setCoordinatorAssignment } from "../../lib/admin/coordinators.ts";
import {
  upsertFormatTemplate,
  getFormatTemplatesConfig,
  listTemplatesForViewer,
  exportableKeysForCategory,
} from "../../lib/export/formatTemplates.ts";

const COORD = "coord1@tce.edu";
const cols = exportableKeysForCategory("case-studies").slice(0, 2);

test("rejects a template with an invalid category or no valid columns", async () => {
  const ctx = await createTestDataRoot("fmt-invalid");
  try {
    assert.equal(upsertFormatTemplate({ label: "X", category: "nope", columns: cols }), null);
    assert.equal(upsertFormatTemplate({ label: "X", category: "case-studies", columns: ["not-a-field"] }), null);
    assert.equal(getFormatTemplatesConfig().templates.length, 0);
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});

test("stores a template with a slugified id and validated columns", async () => {
  const ctx = await createTestDataRoot("fmt-store");
  try {
    const config = upsertFormatTemplate({
      label: "NAAC",
      category: "case-studies",
      columns: [...cols, "not-a-field"],
      ownerScope: "master",
      createdBy: ROOT_MASTER_EMAIL,
    });
    assert.ok(config);
    assert.equal(config.templates[0].id, "naac");
    assert.deepEqual(config.templates[0].columns, cols); // junk column dropped
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});

test("viewer scope: master sees all; coordinator sees own + assigned", async () => {
  const ctx = await createTestDataRoot("fmt-scope");
  try {
    getAdminUsersConfig();
    // Master template, later assigned to the coordinator type.
    upsertFormatTemplate({ label: "NAAC", category: "case-studies", columns: cols, ownerScope: "master", createdBy: ROOT_MASTER_EMAIL });
    // Coordinator-authored template.
    upsertFormatTemplate({ label: "Mine", category: "case-studies", columns: cols, ownerScope: "dlc", createdBy: COORD });

    upsertCoordinatorType({
      id: "cs-exp",
      label: "CS Export",
      categories: ["case-studies"],
      powers: { approveEdits: false, approveDeletes: false, export: true },
      exportTemplateIds: ["naac"],
    });
    setCoordinatorAssignment(COORD, ["cs-exp"]);

    assert.equal(listTemplatesForViewer(ROOT_MASTER_EMAIL).length, 2);

    const forCoord = listTemplatesForViewer(COORD).map((t) => t.id).sort();
    assert.deepEqual(forCoord, ["mine", "naac"]);
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});
