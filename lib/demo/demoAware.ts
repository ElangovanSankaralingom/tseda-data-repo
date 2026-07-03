import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isDemoActive } from "@/lib/demo/state";
import { runInDemoUniverse } from "@/lib/demo/universe";

/**
 * DEMO MODE — request entry points.
 *
 * `AsyncLocalStorage` context does NOT survive back across an `await` into
 * the caller, so the universe must be entered by something that ENCLOSES the
 * work. These two wrappers are those enclosures:
 *
 * - API routes: export every handler wrapped — `export const GET =
 *   demoAware(async (req) => ...)`. Enforced by tests/demo/routeGuard.test.ts
 *   (exemptions carry a `// demo-exempt:` comment).
 * - Server components / pages that read user data directly: wrap the reads —
 *   `await inUserUniverse(email, () => listBinForViewer(email))`.
 *
 * When the session user is not demo-active both wrappers are pass-through.
 */

type AnyRouteHandler = (...args: never[]) => Promise<Response>;

export function demoAware<H extends AnyRouteHandler>(handler: H): H {
  const wrapped = async (...args: never[]): Promise<Response> => {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase() ?? "";
    if (email && (await isDemoActive(email))) {
      return runInDemoUniverse(() => handler(...args));
    }
    return handler(...args);
  };
  return wrapped as H;
}

/** Run server-side reads/writes in the universe of the given user. */
export async function inUserUniverse<T>(email: string, fn: () => Promise<T>): Promise<T> {
  if (email && (await isDemoActive(email))) {
    return runInDemoUniverse(fn);
  }
  return fn();
}
