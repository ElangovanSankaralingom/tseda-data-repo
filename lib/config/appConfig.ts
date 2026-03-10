/**
 * Centralized app configuration.
 * All magic numbers and institution-specific values live here.
 * Change ONE file to reconfigure the entire app.
 *
 * Note: The settings system (lib/settings/) provides async, admin-editable
 * overrides for some of these values. This config provides synchronous
 * compile-time defaults used where async access is impractical.
 */
export const APP_CONFIG = {
  institution: {
    name: "Thiagarajar College of Engineering",
    shortName: "TCE",
    domain: "tce.edu",
    masterAdminEmail: "senarch@tce.edu",
  },
  entryLifecycle: {
    defaultEditWindowDays: 3,
    streakEditWindowBufferDays: 8,
    maxRequestsPerMonth: 3,
  },
  rateLimits: {
    entryMutations: { windowMs: 60_000, max: 30 },
    uploadOps: { windowMs: 60_000, max: 20 },
    adminOps: { windowMs: 60_000, max: 60 },
    entryReads: { windowMs: 60_000, max: 120 },
    authAttempts: { windowMs: 60_000, max: 10 },
    fileDownloads: { windowMs: 60_000, max: 30 },
    health: { windowMs: 60_000, max: 60 },
  },
  security: {
    entryPayloadMaxBytes: 200 * 1024,
    actionPayloadMaxBytes: 32 * 1024,
    uploadMetadataMaxBytes: 32 * 1024,
    entryMaxStringLength: 5_000,
    uploadFieldMaxLength: 512,
    maxAttachmentsPerEntry: 10,
  },
} as const;

/** Email domain suffix with leading @, for use in endsWith checks. */
export const ALLOWED_EMAIL_SUFFIX = `@${APP_CONFIG.institution.domain}`;
