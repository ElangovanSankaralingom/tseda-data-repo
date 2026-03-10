import "server-only";

/**
 * CSRF protection via Origin header validation.
 *
 * Validates that mutation requests (POST, PATCH, PUT, DELETE) originate
 * from an allowed origin. Same-origin requests (no Origin header) are
 * permitted. Cross-origin requests must match NEXTAUTH_URL.
 */

const MUTATION_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>();
  const nextAuthUrl = process.env.NEXTAUTH_URL;
  if (nextAuthUrl) {
    try {
      const url = new URL(nextAuthUrl);
      origins.add(url.origin);
    } catch {
      // Ignore invalid NEXTAUTH_URL
    }
  }
  // Always allow localhost in development
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
  }
  return origins;
}

/**
 * Returns null if the request passes CSRF validation, or an error message
 * string if it should be rejected.
 */
export function validateCsrf(request: Request): string | null {
  const method = request.method.toUpperCase();
  if (!MUTATION_METHODS.has(method)) return null;

  const origin = request.headers.get("origin");

  // No Origin header → same-origin request (browsers always send Origin for
  // cross-origin requests). Allow it.
  if (!origin) return null;

  const allowed = getAllowedOrigins();
  if (allowed.has(origin)) return null;

  return `Cross-origin request from ${origin} is not allowed.`;
}
