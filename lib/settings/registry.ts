import type { SettingDefinition, SettingCategory } from "@/lib/settings/schema";

const SETTINGS: SettingDefinition[] = [
  // --- General ---
  {
    key: "general.appName",
    label: "Application Name",
    description: "Displayed in header and sign-in page",
    category: "general",
    type: "string",
    default: "T'SEDA Data Repository",
    group: "Branding",
  },
  {
    key: "general.institutionName",
    label: "Institution Name",
    description: "Shown on sign-in page and PDF exports",
    category: "general",
    type: "string",
    default: "Thiagarajar College of Engineering",
    group: "Branding",
  },
  {
    key: "general.institutionShort",
    label: "Institution Short Name",
    description: "Used in compact displays",
    category: "general",
    type: "string",
    default: "TCE",
    group: "Branding",
  },
  {
    key: "general.welcomeMessage",
    label: "Dashboard Welcome Message",
    description: "Shown below greeting on dashboard",
    category: "general",
    type: "string",
    default: "Here's your progress overview",
    group: "Content",
  },
  {
    key: "general.timezone",
    label: "Default Timezone",
    description: "Used for date calculations and display",
    category: "general",
    type: "select",
    default: "Asia/Kolkata",
    validation: {
      options: [
        { value: "Asia/Kolkata", label: "IST (Asia/Kolkata)" },
        { value: "UTC", label: "UTC" },
      ],
    },
    group: "Regional",
  },

  // --- Auth ---
  {
    key: "auth.allowedDomain",
    label: "Allowed Email Domain",
    description: "Only emails from this domain can sign in. Leave empty to allow all domains.",
    category: "auth",
    type: "string",
    default: "tce.edu",
    group: "Access Control",
  },
  {
    key: "auth.sessionTimeout",
    label: "Session Timeout",
    description: "Days before users need to sign in again",
    category: "auth",
    type: "number",
    default: 30,
    validation: { min: 1, max: 365 },
    group: "Sessions",
  },

  // --- Entries ---
  {
    key: "entries.defaultEditWindow",
    label: "Default Edit Window",
    description: "Days after Generate that non-streak entries remain editable",
    category: "entries",
    type: "number",
    default: 3,
    validation: { min: 1, max: 30 },
    group: "Edit Windows",
  },
  {
    key: "entries.streakEditBuffer",
    label: "Streak Edit Buffer",
    description: "Days after end date that streak entries remain editable",
    category: "entries",
    type: "number",
    default: 8,
    validation: { min: 1, max: 30 },
    group: "Edit Windows",
  },
  {
    key: "entries.requireEditReason",
    label: "Require Reason for Edit Request",
    description: "Whether users must provide a reason when requesting edit access",
    category: "entries",
    type: "boolean",
    default: false,
    group: "Edit Requests",
  },
  {
    key: "entries.autoFinalizeNotice",
    label: "Finalization Warning Days",
    description: "Show 'expiring soon' warning this many days before edit window closes",
    category: "entries",
    type: "number",
    default: 1,
    validation: { min: 0, max: 7 },
    group: "Notifications",
  },

  // --- Streaks ---
  {
    key: "streaks.enabled",
    label: "Enable Streak System",
    description: "When disabled, no entries are streak-eligible and streak UI is hidden",
    category: "streaks",
    type: "boolean",
    default: true,
    group: "General",
  },
  {
    key: "streaks.showLeaderboard",
    label: "Show Streak Leaderboard",
    description: "Whether to show the leaderboard on analytics page",
    category: "streaks",
    type: "boolean",
    default: true,
    group: "Display",
  },
  {
    key: "streaks.showUserRank",
    label: "Show User Rank on Dashboard",
    description: "Whether users see their leaderboard rank on their dashboard",
    category: "streaks",
    type: "boolean",
    default: true,
    group: "Display",
  },

  // --- Maintenance ---
  {
    key: "maintenance.backupRetentionCount",
    label: "Backup Retention Count",
    description: "Maximum number of backups to keep",
    category: "maintenance",
    type: "number",
    default: 30,
    validation: { min: 1, max: 100 },
    group: "Backups",
  },
  {
    key: "maintenance.integrityCheckInterval",
    label: "Integrity Check Reminder",
    description: "Days between integrity check reminders",
    category: "maintenance",
    type: "number",
    default: 7,
    validation: { min: 1, max: 30 },
    group: "Integrity",
  },
  {
    key: "maintenance.walRetentionDays",
    label: "WAL Retention Days",
    description: "Days to keep WAL event log entries before compaction",
    category: "maintenance",
    type: "number",
    default: 30,
    validation: { min: 7, max: 365 },
    group: "Storage",
  },
  {
    key: "maintenance.maxExportHistory",
    label: "Export History Limit",
    description: "Maximum number of export history entries to keep",
    category: "maintenance",
    type: "number",
    default: 50,
    validation: { min: 10, max: 200 },
    group: "Storage",
  },

  // --- Appearance ---
  {
    key: "appearance.showDotGrid",
    label: "Show Background Dot Grid",
    description: "Subtle dot pattern on page backgrounds",
    category: "appearance",
    type: "boolean",
    default: true,
    group: "Effects",
  },
  {
    key: "appearance.enableAnimations",
    label: "Enable Animations",
    description: "Disable for reduced motion preference",
    category: "appearance",
    type: "boolean",
    default: true,
    group: "Effects",
  },
  {
    key: "appearance.compactMode",
    label: "Compact Mode",
    description: "Reduced spacing and smaller cards for information density",
    category: "appearance",
    type: "boolean",
    default: false,
    group: "Layout",
  },

  // --- Advanced ---
  {
    key: "advanced.analyticsCacheTTL",
    label: "Analytics Cache TTL",
    description: "Minutes to cache analytics computations",
    category: "advanced",
    type: "number",
    default: 60,
    validation: { min: 5, max: 1440 },
    group: "Performance",
  },
  {
    key: "advanced.debugMode",
    label: "Debug Mode",
    description: "Enable verbose logging and debug endpoints. Never enable in production.",
    category: "advanced",
    type: "boolean",
    default: false,
    group: "Debug",
    dangerous: true,
  },
  {
    key: "advanced.maintenanceMode",
    label: "Maintenance Mode",
    description: "When enabled, only admins can access the app. Shows maintenance page to all other users.",
    category: "advanced",
    type: "boolean",
    default: false,
    group: "System",
    dangerous: true,
  },
  {
    key: "advanced.maintenanceMessage",
    label: "Maintenance Message",
    description: "Message shown to users during maintenance mode",
    category: "advanced",
    type: "string",
    default: "T'SEDA is currently undergoing maintenance. Please check back soon.",
    group: "System",
  },
];

// --- Lookup helpers ---

const BY_KEY = new Map<string, SettingDefinition>();
const BY_CATEGORY = new Map<SettingCategory, SettingDefinition[]>();

for (const def of SETTINGS) {
  BY_KEY.set(def.key, def);
  const list = BY_CATEGORY.get(def.category) ?? [];
  list.push(def);
  BY_CATEGORY.set(def.category, list);
}

export function getSettingDefinition(key: string): SettingDefinition | undefined {
  return BY_KEY.get(key);
}

export function getSettingsForCategory(category: SettingCategory): SettingDefinition[] {
  return BY_CATEGORY.get(category) ?? [];
}

export function getAllSettings(): SettingDefinition[] {
  return SETTINGS;
}

export function getAllCategories(): SettingCategory[] {
  return Array.from(BY_CATEGORY.keys());
}

export function getDefaultValue(key: string): unknown {
  return BY_KEY.get(key)?.default;
}

export const CATEGORY_META: Record<SettingCategory, { label: string; description: string; icon: string }> = {
  general: { label: "General", description: "The basics — name, branding, and identity", icon: "Globe" },
  auth: { label: "Authentication", description: "Who gets in and who doesn't", icon: "Lock" },
  entries: { label: "Entries & Edit Windows", description: "Control the flow of data entry", icon: "FileEdit" },
  streaks: { label: "Streaks", description: "Tweak the gamification engine", icon: "Flame" },
  maintenance: { label: "Maintenance", description: "Keep the engine room running smooth", icon: "Wrench" },
  appearance: { label: "Appearance", description: "Make it look the way you want", icon: "Palette" },
  advanced: { label: "Advanced", description: "Here be dragons. Change with caution.", icon: "Terminal" },
};
