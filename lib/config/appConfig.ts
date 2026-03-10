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
    telemetry: { windowMs: 60_000, max: 240 },
    /** Admin maintenance / integrity / backup routes use per-route limits. */
    adminMaintenance: { windowMs: 60_000, max: 3 },
    adminMaintenanceSlow: { windowMs: 300_000, max: 2 },
  },
  security: {
    entryPayloadMaxBytes: 200 * 1024,
    actionPayloadMaxBytes: 32 * 1024,
    uploadMetadataMaxBytes: 32 * 1024,
    entryMaxStringLength: 5_000,
    uploadFieldMaxLength: 512,
    maxAttachmentsPerEntry: 10,
    maxFileSizeBytes: 10 * 1024 * 1024,
    sessionMaxAgeSeconds: 8 * 60 * 60,
  },
  pagination: {
    defaultPageSize: 50,
    maxPageSize: 100,
  },
  cron: {
    walRetentionDays: 30,
    timerWarningHours: 24,
    notificationMaxAgeDays: 30,
    backupKeepLast: 30,
  },
  upload: {
    maxFileSizeBytes: 10 * 1024 * 1024,
    allowedImageMimeTypes: ["image/jpeg", "image/png", "image/webp"] as readonly string[],
    allowedDocMimeTypes: ["application/pdf"] as readonly string[],
  },
} as const;

/** Email domain suffix with leading @, for use in endsWith checks. */
export const ALLOWED_EMAIL_SUFFIX = `@${APP_CONFIG.institution.domain}`;
