import "server-only";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * DEMO MODE — universe resolution (2026-07).
 *
 * Demo mode gives permitted users (master admin + admin-assigned faculty) a
 * PARALLEL data universe for testing and presentations. Everything written in
 * demo mode lands under `<root>/demo/...` and is wiped on exit — real data is
 * never touched.
 *
 * The universe of an operation is decided by the ACTOR (the signed-in user),
 * never by the data owner: a demo-active admin browsing confirmations sees
 * ONLY demo requests; a real user never sees demo data anywhere. Requests are
 * placed into this context by `demoAware()` (API routes) and
 * `inUserUniverse()` (server components) from `lib/demo/demoAware.ts` —
 * see the route guard test (`tests/demo/routeGuard.test.ts`).
 *
 * UNIVERSE-SCOPED stores (fork under /demo): users tree (entries, index,
 * summary, notifications), feed, entry uploads + generated PDFs, quarantine
 * trash, admin action history, analytics cache, export history.
 *
 * SHARED stores (never fork): faculty registry, admin roles, live settings,
 * user preferences, awards points config, and the demo state file itself —
 * they are configuration, not data.
 *
 * Background jobs run with no context → the REAL universe. The nightly job
 * touches demo space only through its expiry sweep (lib/jobs/demoCleanup.ts).
 */

export const DEMO_SEGMENT = "demo";

type UniverseContext = { demo: boolean };

const universeStorage = new AsyncLocalStorage<UniverseContext>();

/** True when the current async execution runs in the demo universe. */
export function isDemoContext(): boolean {
  return universeStorage.getStore()?.demo === true;
}

/** Run a function (and every async continuation it creates) inside the demo
 *  universe. This is the ONLY way in — `enterWith` is deliberately not used
 *  because context set inside an awaited callee does not propagate back to
 *  the awaiting caller. */
export function runInDemoUniverse<T>(fn: () => T): T {
  return universeStorage.run({ demo: true }, fn);
}

/** Explicitly run in the REAL universe (jobs that must never see demo). */
export function runInRealUniverse<T>(fn: () => T): T {
  return universeStorage.run({ demo: false }, fn);
}

/** Resolve a data root against the current universe. Pure path math — the
 *  caller supplies its real root so this module imports no storage code. */
export function universeRoot(realRoot: string): string {
  return isDemoContext() ? path.join(realRoot, DEMO_SEGMENT) : realRoot;
}
