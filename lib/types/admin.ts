// Canonical admin domain types.
// Used by both server-side services (lib/users, lib/admin) and client components.

export type ActivityTrend = "rising" | "stable" | "declining" | "inactive";

export type UserProfile = {
  email: string;
  name: string;
  image?: string;
  department?: string;
  designation?: string;
  role: "user" | "admin";
  adminRoles: string[];
  isActive: boolean;
  firstSeenAt: string | null;
  lastActiveAt: string | null;
  totalEntries: number;
  entriesByCategory: Record<string, number>;
  entriesByStatus: Record<string, number>;
  completionRate: number;
  streakActivated: number;
  streakWins: number;
  editRequests: number;
  activityTrend: ActivityTrend;
};

export type UserStats = {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  adminUsers: number;
  averageEntriesPerUser: number;
  averageCompletionRate: number;
};

export type AuditEvent = {
  ts: string;
  actorEmail: string;
  actorRole: "user" | "admin";
  userEmail: string;
  category: string;
  entryId: string;
  action: string;
  statusFrom: string | null;
  statusTo: string | null;
  summary: string;
};

export type AuditStats = {
  totalEvents: number;
  byAction: Record<string, number>;
  byCategory: Record<string, number>;
  byActor: Record<string, number>;
  byUser: Record<string, number>;
  recentDays: { date: string; count: number }[];
  topEntries: { entryId: string; category: string; userEmail: string; count: number }[];
};
