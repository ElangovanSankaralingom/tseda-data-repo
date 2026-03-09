import type { IntegrityReport } from "@/lib/integrity/report";

export type Option = { key: string; label: string };

export type PreviewData = {
  recordCount: number;
  userCount: number;
  categoryBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
};

export type HealthStatus = "green" | "amber" | "red";

export type DashboardData = {
  metrics: {
    totalUsers: number;
    totalEntries: number;
    activeStreaks: number;
    streakWins: number;
    pendingRequests: number;
    completionRate: number;
    entryGrowth: number;
    newUsersThisMonth: number;
  };
  recentActivity: unknown[];
  entryTrend: unknown[];
  health: {
    backup: { status: HealthStatus; lastBackup: string | null; count: number; size: string };
    integrity: { status: HealthStatus; lastScan: string | null; score: number | null; issues: number; isOverdue: boolean };
    storage: { status: HealthStatus; totalSize: string; backupSize: string };
    audit: { status: HealthStatus; totalEvents: number; eventsToday: number };
    system: { maintenanceMode: boolean };
  };
  leaderboard: unknown[];
  categoryOverview: {
    slug: string;
    name: string;
    totalEntries: number;
    statusBreakdown: Record<string, number>;
    streakActivated: number;
    streakWins: number;
  }[];
  pendingItems: unknown[];
  settingsChanged: number;
};

export type FeatureCard = {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  accent: string;
  accentBg: string;
  badge?: number;
  badgeColor?: string;
  badgeDot?: boolean;
};

export type JobDef = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  endpoint: string;
  method: "POST" | "GET";
  accent: string;
  iconBg: string;
};

export type Pill = { label: string; color?: string };

export type ViewMode = "timeline" | "table";

export type CategoryCardDef = {
  key: keyof IntegrityReport["checks"];
  label: string;
  icon: React.ReactNode;
  accentRing: string;
  iconBg: string;
  passText: string;
  failText: string;
};

export const RANGES = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "3m", label: "3 months", days: 90 },
  { key: "12m", label: "12 months", days: 365 },
  { key: "all", label: "All time", days: 0 },
] as const;

export type RangeKey = (typeof RANGES)[number]["key"];

export type UserManagementFilters = {
  search: string;
  role: "all" | "user" | "admin";
  activity: "all" | "active" | "inactive";
  sort: string;
};
