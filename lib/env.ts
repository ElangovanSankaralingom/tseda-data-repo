/**
 * Environment variable validation.
 * Import this module early in the app to fail fast on missing config.
 */

const REQUIRED_ENV_VARS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
] as const;

export function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`
    );
  }

  // CRON_SECRET is optional by design (blank = nightly endpoint disabled),
  // but in production that must be a loud, deliberate choice — not a silent
  // misconfiguration discovered weeks later as 401s in the cron logs.
  if (process.env.NODE_ENV === "production" && !process.env.CRON_SECRET?.trim()) {
    console.warn(
      JSON.stringify({
        level: "warn",
        ts: new Date().toISOString(),
        event: "env.cronSecret.missing",
        message:
          "CRON_SECRET is not set — /api/cron/nightly is disabled. Nightly maintenance (auto-finalise, auto-delete, timer warnings, backups, integrity checks) will NOT run.",
      }),
    );
  }
}
