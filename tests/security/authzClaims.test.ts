import assert from "node:assert/strict";
import test from "node:test";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import { setAdminUsersConfig, isMasterAdmin, canExport, canManageAdminUsers, canAccessSettings } from "../../lib/admin/roles.ts";
import { addFaculty, setBetaStatus, getBetaStatus, isBetaTester } from "../../lib/admin/facultyRegistry.ts";

/**
 * AUTHORIZATION RED-TEAM REGRESSION (2026-07, Elan's security audit).
 *
 * These lock the four claims the audit tried to break — at the FUNCTION
 * level, where the real authorization decisions live (the routes are thin
 * wrappers over these). If a future refactor loosens any of them, the suite
 * fails loudly instead of shipping a privilege-escalation.
 *
 *   A. Only a MASTER_ADMIN may delete feed events (route gates on isMasterAdmin).
 *   B. A user can never self-promote to beta "member" — the state machine
 *      only reaches "requested", and setBetaStatus enum-clamps.
 *   C/D. isBetaTester requires exactly "member", so the layout/ThemeProvider/
 *      prefs-API clamps deny dark-mode + Tamil to everyone else.
 */

async function withRoles<T>(run: () => Promise<T> | T): Promise<T> {
  const sandbox = await createTestDataRoot("authz-claims");
  try {
    return await run();
  } finally {
    sandbox.restore();
    await sandbox.cleanup();
  }
}

const MASTER = "master@tce.edu";
const REVIEWER = "reviewer@tce.edu";
const EXPORTER = "exporter@tce.edu";
const PLAIN = "plain@tce.edu";

function seedRoles() {
  setAdminUsersConfig([
    { email: MASTER, roles: ["MASTER_ADMIN"] },
    { email: REVIEWER, roles: ["REVIEWER"] },
    { email: EXPORTER, roles: ["EXPORT_ADMIN"] },
    // PLAIN has no admin roles.
  ]);
}

test("Claim A: only MASTER_ADMIN passes the feed-delete gate (isMasterAdmin)", async () => {
  await withRoles(() => {
    seedRoles();
    assert.equal(isMasterAdmin(MASTER), true, "master may delete feed events");
    // Every non-master role the app knows must be rejected — a reviewer or
    // export-admin has console access but NOT feed moderation.
    assert.equal(isMasterAdmin(REVIEWER), false, "reviewer must NOT delete feed events");
    assert.equal(isMasterAdmin(EXPORTER), false, "export-admin must NOT delete feed events");
    assert.equal(isMasterAdmin(PLAIN), false, "plain faculty must NOT delete feed events");
    assert.equal(isMasterAdmin("nobody@tce.edu"), false, "unknown email must NOT delete feed events");
    assert.equal(isMasterAdmin(""), false, "empty email must NOT delete feed events");
  });
});

test("Claim B: self-service beta can only reach 'requested', never 'member'", async () => {
  await withRoles(() => {
    addFaculty(PLAIN, "Plain Faculty", MASTER);

    // The /api/me/beta POST transition is exactly this expression — a user
    // never supplies the status, and a non-member can only become "requested".
    const selfRequest = (email: string) => (getBetaStatus(email) === "member" ? "member" : "requested");

    assert.equal(getBetaStatus(PLAIN), "none");
    setBetaStatus(PLAIN, selfRequest(PLAIN));
    assert.equal(getBetaStatus(PLAIN), "requested", "self-request lands on 'requested'");
    assert.equal(isBetaTester(PLAIN), false, "a 'requested' user is NOT a beta tester");

    // Re-requesting stays 'requested' — no drift to member.
    setBetaStatus(PLAIN, selfRequest(PLAIN));
    assert.equal(getBetaStatus(PLAIN), "requested");
  });
});

test("Claim B: setBetaStatus enum-clamps — forged status can never persist as member", async () => {
  await withRoles(() => {
    addFaculty(PLAIN, "Plain Faculty", MASTER);
    // A forged value (what an attacker would inject) clamps to "none".
    setBetaStatus(PLAIN, "member" as never); // legitimate path (admin) — sanity
    assert.equal(getBetaStatus(PLAIN), "member");
    setBetaStatus(PLAIN, "superuser" as never);
    assert.equal(getBetaStatus(PLAIN), "none", "garbage status clamps to none, not member");
  });
});

test("Claim B: the admin beta setter is MASTER-only (canManageAdminUsers)", async () => {
  await withRoles(() => {
    seedRoles();
    assert.equal(canManageAdminUsers(MASTER), true);
    assert.equal(canManageAdminUsers(REVIEWER), false, "reviewer cannot run the faculty/setBeta route");
    assert.equal(canManageAdminUsers(EXPORTER), false);
    assert.equal(canManageAdminUsers(PLAIN), false);
  });
});

test("Claim C/D: isBetaTester requires exactly 'member' — the beta clamp denies everyone else", async () => {
  await withRoles(() => {
    addFaculty(PLAIN, "Plain Faculty", MASTER);

    // The layout + ThemeProvider clamp is `betaTester ? pref : default`, and
    // the prefs API rejects (dark||ta) when !isBetaTester. All three read this.
    const clampMode = (betaTester: boolean, pref: "light" | "dark") => (betaTester ? pref : "light");
    const clampLang = (betaTester: boolean, pref: "en" | "ta") => (betaTester ? pref : "en");

    for (const status of ["none", "requested"] as const) {
      setBetaStatus(PLAIN, status);
      assert.equal(isBetaTester(PLAIN), false, `${status} is not a tester`);
      assert.equal(clampMode(isBetaTester(PLAIN), "dark"), "light", `${status} clamped to light`);
      assert.equal(clampLang(isBetaTester(PLAIN), "ta"), "en", `${status} clamped to en`);
    }

    setBetaStatus(PLAIN, "member");
    assert.equal(isBetaTester(PLAIN), true);
    assert.equal(clampMode(isBetaTester(PLAIN), "dark"), "dark", "member keeps dark");
    assert.equal(clampLang(isBetaTester(PLAIN), "ta"), "ta", "member keeps Tamil");
  });
});

test("export capability is a real role gate (canExport = master or export-admin only)", async () => {
  await withRoles(() => {
    seedRoles();
    assert.equal(canExport(MASTER), true);
    assert.equal(canExport(EXPORTER), true);
    assert.equal(canExport(REVIEWER), false, "reviewer cannot export faculty data");
    assert.equal(canExport(PLAIN), false, "plain faculty cannot export another user's entries");
    // Settings (destructive/reset surface) is master-only.
    assert.equal(canAccessSettings(EXPORTER), false);
    assert.equal(canAccessSettings(PLAIN), false);
    assert.equal(canAccessSettings(MASTER), true);
  });
});
