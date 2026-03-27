import {
  AlertOctagon,
  Archive,
  Bell,
  CheckCircle,
  Clock,
  FileEdit,
  HardDrive,
  Lock,
  Megaphone,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Trophy,
  UserPlus,
  Wrench,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PersistentNotificationType, AdminNotificationType } from "@/lib/confirmations/types";

export interface NotificationTypeStyle {
  Icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}

export const USER_NOTIFICATION_STYLES: Record<PersistentNotificationType, NotificationTypeStyle> = {
  edit_request_granted: { Icon: CheckCircle, iconBg: "bg-emerald-500/10", iconColor: "text-emerald-500" },
  edit_request_rejected: { Icon: XCircle, iconBg: "bg-red-500/10", iconColor: "text-red-500" },
  delete_approved: { Icon: Trash2, iconBg: "bg-red-500/10", iconColor: "text-red-500" },
  delete_rejected: { Icon: XCircle, iconBg: "bg-red-500/10", iconColor: "text-red-500" },
  auto_archived: { Icon: Archive, iconBg: "bg-amber-500/10", iconColor: "text-amber-500" },
  timer_warning: { Icon: Clock, iconBg: "bg-orange-500/10", iconColor: "text-orange-500" },
  entry_finalized: { Icon: Lock, iconBg: "bg-[var(--color-dropdown-hover)]", iconColor: "text-[var(--color-text-secondary)]" },
  streak_won: { Icon: Trophy, iconBg: "bg-amber-500/10", iconColor: "text-amber-500" },
  system_announcement: { Icon: Megaphone, iconBg: "bg-blue-500/10", iconColor: "text-blue-500" },
};

export const ADMIN_NOTIFICATION_STYLES: Record<AdminNotificationType, NotificationTypeStyle> = {
  edit_request: { Icon: FileEdit, iconBg: "bg-purple-500/10", iconColor: "text-purple-500" },
  delete_request: { Icon: Trash2, iconBg: "bg-red-500/10", iconColor: "text-red-500" },
  pending_requests_reminder: { Icon: FileEdit, iconBg: "bg-purple-500/10", iconColor: "text-purple-500" },
  backup_overdue: { Icon: ShieldAlert, iconBg: "bg-amber-500/10", iconColor: "text-amber-500" },
  integrity_issues: { Icon: ShieldCheck, iconBg: "bg-red-500/10", iconColor: "text-red-500" },
  wal_warning: { Icon: HardDrive, iconBg: "bg-amber-500/10", iconColor: "text-amber-500" },
  new_user: { Icon: UserPlus, iconBg: "bg-blue-500/10", iconColor: "text-blue-500" },
  user_status_change: { Icon: UserPlus, iconBg: "bg-[var(--color-dropdown-hover)]", iconColor: "text-[var(--color-text-secondary)]" },
  settings_changed: { Icon: Settings, iconBg: "bg-[var(--color-dropdown-hover)]", iconColor: "text-[var(--color-text-secondary)]" },
  migration_complete: { Icon: Wrench, iconBg: "bg-emerald-500/10", iconColor: "text-emerald-500" },
  system_error: { Icon: AlertOctagon, iconBg: "bg-red-500/10", iconColor: "text-red-500" },
};

/** Default style for unknown notification types */
export const FALLBACK_STYLE: NotificationTypeStyle = {
  Icon: Bell,
  iconBg: "bg-[var(--color-dropdown-hover)]",
  iconColor: "text-[var(--color-text-secondary)]",
};
