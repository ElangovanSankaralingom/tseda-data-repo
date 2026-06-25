import {
  FileEdit,
  Users,
  Network,
  BarChart3,
  Download,
  Shield,
  ShieldCheck,
  ScrollText,
  Wrench,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TranslationKey } from "@/lib/i18n";

export interface AdminTool {
  /** Unique ID matching the permission key */
  id: string;
  /** i18n translation key for the title */
  titleKey: TranslationKey;
  /** i18n translation key for the description */
  descriptionKey: TranslationKey;
  /** Route path */
  href: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Tailwind text color class */
  accentText: string;
  /** Tailwind background color class */
  accentBg: string;
  /** Badge type: 'count' shows a number, 'dot' shows a status dot */
  badgeType?: "count" | "dot";
  /** Badge color class */
  badgeColor?: string;
  /** Which metric key to read for count badges */
  metricKey?: string;
  /** Which health key to read for dot badges */
  healthKey?: string;
}

export const ADMIN_TOOLS: AdminTool[] = [
  {
    id: "confirmations",
    titleKey: "adminConsole.editRequests",
    descriptionKey: "adminConsole.editRequestsDesc",
    href: "/admin/confirmations",
    icon: FileEdit,
    accentText: "text-purple-500",
    accentBg: "bg-purple-500/10",
    badgeType: "count",
    badgeColor: "bg-[var(--color-status-warning)]",
    metricKey: "pendingRequests",
  },
  {
    id: "users",
    titleKey: "adminConsole.users",
    descriptionKey: "adminConsole.usersDesc",
    href: "/admin/users",
    icon: Users,
    accentText: "text-blue-500",
    accentBg: "bg-blue-500/10",
    badgeType: "count",
    badgeColor: "bg-blue-500",
    metricKey: "newUsersThisMonth",
  },
  {
    id: "coordinators",
    titleKey: "adminConsole.coordinators",
    descriptionKey: "adminConsole.coordinatorsDesc",
    href: "/admin/coordinators",
    icon: Network,
    accentText: "text-[var(--color-palette-cyan-fg)]",
    accentBg: "bg-[var(--color-palette-cyan-bg)]",
  },
  {
    id: "analytics",
    titleKey: "adminConsole.analytics",
    descriptionKey: "adminConsole.analyticsDesc",
    href: "/admin/analytics",
    icon: BarChart3,
    accentText: "text-emerald-500",
    accentBg: "bg-emerald-500/10",
  },
  {
    id: "export",
    titleKey: "adminConsole.export",
    descriptionKey: "adminConsole.exportDesc",
    href: "/admin/export",
    icon: Download,
    accentText: "text-amber-500",
    accentBg: "bg-amber-500/10",
  },
  {
    id: "backups",
    titleKey: "adminConsole.backup",
    descriptionKey: "adminConsole.backupDesc",
    href: "/admin/backups",
    icon: Shield,
    accentText: "text-indigo-500",
    accentBg: "bg-indigo-500/10",
    badgeType: "dot",
    badgeColor: "bg-[var(--color-status-error)]",
    healthKey: "backup",
  },
  {
    id: "integrity",
    titleKey: "adminConsole.integrity",
    descriptionKey: "adminConsole.integrityDesc",
    href: "/admin/integrity",
    icon: ShieldCheck,
    accentText: "text-emerald-500",
    accentBg: "bg-emerald-500/10",
    badgeType: "dot",
    badgeColor: "bg-[var(--color-status-error)]",
    healthKey: "integrity",
  },
  {
    id: "audit",
    titleKey: "adminConsole.auditTrail",
    descriptionKey: "adminConsole.auditTrailDesc",
    href: "/admin/audit",
    icon: ScrollText,
    accentText: "text-[var(--color-text-secondary)]",
    accentBg: "bg-[var(--color-dropdown-hover)]",
  },
  {
    id: "maintenance",
    titleKey: "adminConsole.maintenance",
    descriptionKey: "adminConsole.maintenanceDesc",
    href: "/admin/maintenance",
    icon: Wrench,
    accentText: "text-rose-500",
    accentBg: "bg-rose-500/10",
  },
  {
    id: "settings",
    titleKey: "adminConsole.settings",
    descriptionKey: "adminConsole.settingsDesc",
    href: "/admin/settings",
    icon: Settings,
    accentText: "text-[var(--color-text-secondary)]",
    accentBg: "bg-[var(--color-dropdown-hover)]",
    badgeType: "dot",
    badgeColor: "bg-[var(--color-status-warning)]",
    healthKey: "system",
  },
];
