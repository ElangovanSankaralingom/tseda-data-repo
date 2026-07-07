import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import { getAdminUsersConfig } from "../../lib/admin/roles.ts";
import { ROOT_MASTER_EMAIL } from "../../lib/admin.ts";
import {
  canViewAnalytics,
  canManageAdminUsers,
  canAccessSettings,
  canRunMaintenance,
  canRunIntegrityTools,
  canManageBackups,
  canExport,
  canViewAudit,
  canAccessAdminConsole,
  canApproveConfirmations,
  canManageEditRequests,
  canAccessAdminSearch,
} from "../../lib/admin/roles.ts";
import {
  upsertCoordinatorType,
  setCoordinatorAssignment,
  canApproveEditForCategory,
  canApproveDeleteForCategory,
  canCoordinatorExport,
  canCoordinatorApproveEdit,
  canCoordinatorApproveDelete,
  canCoordinatorEnterData,
} from "../../lib/admin/coordinators.ts";
import { addFaculty, setBetaStatus, getBetaStatus, isBetaTester } from "../../lib/admin/facultyRegistry.ts";
import { isDemoParticipant, enterDemoMode, isDemoActive, setDemoRoster, resetDemoStateCache } from "../../lib/demo/state.ts";
import { upsertCategoryEntry } from "../../lib/dataStore.ts";
import { grantEditAccess } from "../../lib/entries/lifecycle.ts";
import type { CategoryKey } from "../../lib/entries/types.ts";

const COORD = "coord1@tce.edu";

// Locks the governance invariant: a coordinator must NEVER gain a master-only
// capability. If a future change leaks one of these, this test fails.
test("a coordinator holds NO master-only capability", async () => {
  const ctx = await createTestDataRoot("perm-matrix");
  try {
    getAdminUsersConfig();
    upsertCoordinatorType({
      id: "cs",
      label: "CS",
      categories: ["case-studies"],
      powers: { approveEdits: true, approveDeletes: true, export: true },
    });
    setCoordinatorAssignment(COORD, ["cs"]);

    // Master-only — all must be false for a coordinator.
    for (const check of [
      canViewAnalytics,
      canManageAdminUsers,
      canAccessSettings,
      canRunMaintenance,
      canRunIntegrityTools,
      canManageBackups,
      canExport,
      canViewAudit,
    ]) {
      assert.equal(check(COORD), false, `${check.name} must be false for a coordinator`);
    }

    // But their scoped powers DO work.
    assert.equal(canApproveEditForCategory(COORD, "case-studies"), true);
    assert.equal(canCoordinatorExport(COORD, "case-studies"), true);

    // And the master keeps the master-only capabilities.
    assert.equal(canViewAnalytics(ROOT_MASTER_EMAIL), true);
    assert.equal(canManageAdminUsers(ROOT_MASTER_EMAIL), true);
    assert.equal(canExport(ROOT_MASTER_EMAIL), true);
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});

/* ═════════════════════════════════════════════════════════════════════════
   FULL ROLE × ACTION × RESOURCE MATRIX (Elan's permission audit, 2026-07)
   Personas: master · coordinator (4 powers on case-studies + placements)
   · plain faculty · beta member · demo-roster faculty · outsider.
   Every cell asserted against the REAL permission functions; engine-level
   behavioral proofs for the denials that matter most; source-level guards
   for gates that live at route level (dlc scope, feed moderation, beta
   preference gate) so refactors can't silently drop them.
   ═════════════════════════════════════════════════════════════════════ */

const MASTER = ROOT_MASTER_EMAIL;
const FACULTY = "plain.faculty@tce.edu";
const BETA = "beta.member@tce.edu";
const DEMOUSER = "demo.user@tce.edu";
const OUTSIDER = "outsider@tce.edu"; // never registered anywhere

async function withMatrixSandbox<T>(label: string, run: () => Promise<T>): Promise<T> {
  const ctx = await createTestDataRoot(label);
  try {
    resetDemoStateCache();
    getAdminUsersConfig();
    // Registry roster (beta + demo checks read it).
    for (const [email, name] of [
      [FACULTY, "Plain Faculty"],
      [BETA, "Beta Member"],
      [DEMOUSER, "Demo User"],
      [COORD, "Coordinator One"],
    ] as const) {
      addFaculty(email, name, MASTER);
    }
    // Coordinator: ALL FOUR powers, scoped to case-studies + student-placements.
    upsertCoordinatorType({
      id: "matrix-type",
      label: "Matrix Type",
      categories: ["case-studies", "student-placements"] as never,
      powers: { approveEdits: true, approveDeletes: true, export: true, enterData: true },
    });
    setCoordinatorAssignment(COORD, ["matrix-type"]);
    setBetaStatus(BETA, "member");
    return await run();
  } finally {
    resetDemoStateCache();
    ctx.restore();
    await ctx.cleanup();
  }
}

test("matrix: global capabilities per persona (full cross product)", async () => {
  await withMatrixSandbox("perm-matrix-global", async () => {
    const capabilities: Array<[string, (email: string) => boolean]> = [
      ["canAccessAdminConsole", canAccessAdminConsole],
      ["canApproveConfirmations", canApproveConfirmations],
      ["canManageEditRequests", canManageEditRequests],
      ["canExport", canExport],
      ["canViewAudit", canViewAudit],
      ["canViewAnalytics", canViewAnalytics],
      ["canManageAdminUsers", canManageAdminUsers],
      ["canAccessSettings", canAccessSettings],
      ["canRunMaintenance", canRunMaintenance],
      ["canRunIntegrityTools", canRunIntegrityTools],
      ["canManageBackups", canManageBackups],
      ["canAccessAdminSearch", canAccessAdminSearch],
    ];
    // Master: everything. Everyone else (coordinator, faculty, beta, demo,
    // outsider): NOTHING global — beta/demo membership and coordinator
    // powers must never leak a global capability.
    for (const [name, fn] of capabilities) {
      assert.equal(fn(MASTER), true, `master must hold ${name}`);
      for (const persona of [COORD, FACULTY, BETA, DEMOUSER, OUTSIDER]) {
        assert.equal(fn(persona), false, `${persona} must NOT hold ${name}`);
      }
    }
  });
});

test("matrix: coordinator powers are category-scoped, composed checks agree", async () => {
  await withMatrixSandbox("perm-matrix-coord", async () => {
    const inScope = "case-studies";
    const dlcInScope = "student-placements";
    const outOfScope = "fdp-attended";

    const powers: Array<[string, (email: string, category: string) => boolean]> = [
      ["approveEdit", canCoordinatorApproveEdit],
      ["approveDelete", canCoordinatorApproveDelete],
      ["export", canCoordinatorExport],
      ["enterData", canCoordinatorEnterData],
    ];
    for (const [name, fn] of powers) {
      assert.equal(fn(COORD, inScope), true, `coordinator ${name} in scope`);
      assert.equal(fn(COORD, outOfScope), false, `coordinator ${name} OUT of scope must deny`);
      // No other persona gets coordinator powers anywhere.
      for (const persona of [FACULTY, BETA, DEMOUSER, OUTSIDER]) {
        assert.equal(fn(persona, inScope), false, `${persona} must not hold ${name}`);
      }
    }

    // Composed approval checks: global approver OR scoped coordinator.
    assert.equal(canApproveEditForCategory(MASTER, outOfScope), true, "master approves anywhere");
    assert.equal(canApproveEditForCategory(COORD, inScope), true);
    assert.equal(canApproveEditForCategory(COORD, outOfScope), false);
    assert.equal(canApproveDeleteForCategory(COORD, inScope), true);
    assert.equal(canApproveDeleteForCategory(COORD, outOfScope), false);
    assert.equal(canApproveEditForCategory(FACULTY, inScope), false);

    // DLC entry power: ONLY the assigned coordinator (and never master by
    // default — dashboard/routes rely on this exact rule).
    assert.equal(canCoordinatorEnterData(COORD, dlcInScope), true);
    assert.equal(canCoordinatorEnterData(MASTER, dlcInScope), false, "master has no implicit enterData");
    assert.equal(canCoordinatorEnterData(FACULTY, dlcInScope), false);
  });
});

test("matrix: beta gate — members only, self-request never self-promotes", async () => {
  await withMatrixSandbox("perm-matrix-beta", async () => {
    assert.equal(isBetaTester(BETA), true, "member is a beta tester");
    for (const persona of [FACULTY, DEMOUSER, OUTSIDER]) {
      assert.equal(isBetaTester(persona), false, `${persona} is not a beta tester`);
    }
    // The self-service transition can only ever REQUEST (none → requested);
    // 'member' is admin-granted. Mirrors /api/me/beta POST semantics.
    setBetaStatus(FACULTY, "requested");
    assert.equal(getBetaStatus(FACULTY), "requested");
    assert.equal(isBetaTester(FACULTY), false, "'requested' grants NOTHING");
    // Withdrawal drops everything.
    setBetaStatus(BETA, "none");
    assert.equal(isBetaTester(BETA), false);
  });
});

test("matrix: demo mode — participants are master + roster, nobody else enters", async () => {
  await withMatrixSandbox("perm-matrix-demo", async () => {
    // Master is always a participant; nobody else before the roster is set.
    assert.equal(await isDemoParticipant(MASTER), true);
    for (const persona of [COORD, FACULTY, BETA, DEMOUSER, OUTSIDER]) {
      assert.equal(await isDemoParticipant(persona), false, `${persona} not a participant pre-roster`);
    }
    await assert.rejects(() => enterDemoMode(FACULTY), /Not permitted/, "non-participant cannot enter");

    // Roster: only registry-allowed faculty stick; the acting master is
    // excluded from their own roster submission; outsiders are dropped.
    await setDemoRoster([DEMOUSER, OUTSIDER, MASTER], MASTER);
    assert.equal(await isDemoParticipant(DEMOUSER), true);
    assert.equal(await isDemoParticipant(OUTSIDER), false, "unregistered email never joins the roster");
    assert.equal(await isDemoParticipant(MASTER), true, "master participates regardless of roster");

    await enterDemoMode(DEMOUSER);
    assert.equal(await isDemoActive(DEMOUSER), true);

    // Removing an active user from the roster force-exits their demo.
    await setDemoRoster([], MASTER);
    assert.equal(await isDemoActive(DEMOUSER), false, "roster removal exits the demo session");
    assert.equal(await isDemoParticipant(DEMOUSER), false);
  });
});

test("matrix: engine denials — self-approval block, category scoping, plain users", async () => {
  await withMatrixSandbox("perm-matrix-engine", async () => {
    const category = "case-studies" as CategoryKey;
    const plant = async (owner: string, id: string, cat: CategoryKey = category) => {
      await upsertCategoryEntry(owner, cat, {
        id,
        confirmationStatus: "EDIT_REQUESTED",
        requestEditStatus: "pending",
        committedAtISO: "2026-06-01T09:00:00.000Z",
        editRequestedAt: "2026-06-20T09:00:00.000Z",
        academicYear: "Academic Year 2025-2026",
        semesterType: "EVEN",
        createdAt: "2026-06-01T09:00:00.000Z",
        updatedAt: "2026-06-20T09:00:00.000Z",
      } as never);
    };

    // Coordinator grants an edit on ANOTHER user's entry in their category — allowed.
    await plant(FACULTY, "e-ok");
    const granted = await grantEditAccess(COORD, category, FACULTY, "e-ok");
    assert.equal(String((granted as Record<string, unknown>).confirmationStatus), "EDIT_GRANTED");

    // E1 self-approval block: coordinator on their OWN entry — FORBIDDEN.
    await plant(COORD, "e-self");
    await assert.rejects(
      () => grantEditAccess(COORD, category, COORD, "e-self"),
      /Forbidden/,
      "coordinator must never approve their own entry",
    );

    // Out-of-scope category — FORBIDDEN even for a real coordinator.
    await plant(FACULTY, "e-oos", "fdp-attended" as CategoryKey);
    await assert.rejects(
      () => grantEditAccess(COORD, "fdp-attended" as CategoryKey, FACULTY, "e-oos"),
      /Forbidden/,
      "coordinator powers must not travel outside their categories",
    );

    // Plain faculty / beta member / demo user — FORBIDDEN everywhere.
    await plant(FACULTY, "e-deny");
    for (const persona of [BETA, DEMOUSER, OUTSIDER]) {
      await assert.rejects(
        () => grantEditAccess(persona, category, FACULTY, "e-deny"),
        /Forbidden/,
        `${persona} must not grant edits`,
      );
    }

    // Master on their own entry: global approvers are NOT self-blocked
    // (the E1 block targets coordinators; master accountability is the
    // action-history log). Locks today's semantics so a change is loud.
    await plant(MASTER, "e-master-self");
    const masterSelf = await grantEditAccess(MASTER, category, MASTER, "e-master-self");
    assert.equal(String((masterSelf as Record<string, unknown>).confirmationStatus), "EDIT_GRANTED");
  });
});

test("matrix: route-level gates exist in source (dlc scope, feed moderation, beta preferences)", () => {
  const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

  // Entry-DLC: every mutating verb in the shared category handler checks scope.
  const handler = read("lib/api/categoryRouteHandler.ts");
  const scopeChecks = handler.match(/canMutateInScope\(/g) ?? [];
  assert.ok(scopeChecks.length >= 4, "POST/PATCH/DELETE (+helper) must all consult canMutateInScope");

  // File handler enforces the same scope.
  assert.ok(
    read("lib/api/categoryFileHandler.ts").includes("canCoordinatorEnterData") ||
      read("lib/api/categoryFileHandler.ts").includes("canMutateInScope"),
    "file handler must enforce dlc scope",
  );

  // Feed moderation is master-only at the route.
  assert.ok(
    read("app/api/feed/route.ts").includes("isMasterAdmin"),
    "feed DELETE must gate on isMasterAdmin",
  );

  // Beta gate: dark mode + Tamil remain beta-only in preferences.
  const prefs = read("app/api/me/preferences/route.ts");
  assert.ok(
    prefs.includes("isBetaTester") && prefs.includes('"dark"') && prefs.includes('"ta"'),
    "preferences route must gate dark/ta behind isBetaTester",
  );

  // Award scoring surfaces: committee points + point overrides are
  // settings-tier; the scores view is console-tier.
  assert.ok(read("app/api/admin/awards/interview/route.ts").includes("canAccessSettings"));
  assert.ok(read("app/api/admin/awards/points/route.ts").includes("canAccessSettings"));
  assert.ok(read("app/api/admin/awards/route.ts").includes("canAccessAdminConsole"));

  // Demo roster management is master-only.
  assert.ok(read("app/api/admin/demo/route.ts").includes("isMasterAdmin"));
});
