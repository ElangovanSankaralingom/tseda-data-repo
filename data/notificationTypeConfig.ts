import {
  AlertOctagon,
  Archive,
  Bell,
  CheckCircle,
  Clock,
  FileEdit,
  HardDrive,
  Heart,
  Lock,
  Megaphone,
  Settings,
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
  edit_request_granted: { Icon: CheckCircle, iconBg: "bg-[var(--color-status-success-bg)]", iconColor: "text-[var(--color-status-success)]" },
  edit_request_rejected: { Icon: XCircle, iconBg: "bg-[var(--color-status-error-bg)]", iconColor: "text-[var(--color-status-error)]" },
  delete_approved: { Icon: Trash2, iconBg: "bg-[var(--color-status-error-bg)]", iconColor: "text-[var(--color-status-error)]" },
  delete_rejected: { Icon: XCircle, iconBg: "bg-[var(--color-status-error-bg)]", iconColor: "text-[var(--color-status-error)]" },
  auto_archived: { Icon: Archive, iconBg: "bg-[var(--color-status-warning-bg)]", iconColor: "text-[var(--color-status-warning)]" },
  timer_warning: { Icon: Clock, iconBg: "bg-[var(--color-status-warning-bg)]", iconColor: "text-[var(--color-status-warning)]" },
  entry_finalized: { Icon: Lock, iconBg: "bg-[var(--color-dropdown-hover)]", iconColor: "text-[var(--color-text-secondary)]" },
  streak_won: { Icon: Trophy, iconBg: "bg-[var(--color-status-warning-bg)]", iconColor: "text-[var(--color-status-warning)]" },
  feed_reaction: { Icon: Heart, iconBg: "bg-[var(--color-palette-rose-bg)]", iconColor: "text-[var(--color-palette-rose-fg)]" },
  system_announcement: { Icon: Megaphone, iconBg: "bg-[var(--color-status-info-bg)]", iconColor: "text-[var(--color-status-info)]" },
};

export const ADMIN_NOTIFICATION_STYLES: Record<AdminNotificationType, NotificationTypeStyle> = {
  edit_request: { Icon: FileEdit, iconBg: "bg-[var(--color-status-info-bg)]", iconColor: "text-[var(--color-status-info)]" },
  delete_request: { Icon: Trash2, iconBg: "bg-[var(--color-status-error-bg)]", iconColor: "text-[var(--color-status-error)]" },
  pending_requests_reminder: { Icon: FileEdit, iconBg: "bg-[var(--color-status-info-bg)]", iconColor: "text-[var(--color-status-info)]" },
  backup_overdue: { Icon: ShieldAlert, iconBg: "bg-[var(--color-status-warning-bg)]", iconColor: "text-[var(--color-status-warning)]" },
  integrity_issues: { Icon: ShieldCheck, iconBg: "bg-[var(--color-status-error-bg)]", iconColor: "text-[var(--color-status-error)]" },
  wal_warning: { Icon: HardDrive, iconBg: "bg-[var(--color-status-warning-bg)]", iconColor: "text-[var(--color-status-warning)]" },
  new_user: { Icon: UserPlus, iconBg: "bg-[var(--color-status-info-bg)]", iconColor: "text-[var(--color-status-info)]" },
  user_status_change: { Icon: UserPlus, iconBg: "bg-[var(--color-dropdown-hover)]", iconColor: "text-[var(--color-text-secondary)]" },
  settings_changed: { Icon: Settings, iconBg: "bg-[var(--color-dropdown-hover)]", iconColor: "text-[var(--color-text-secondary)]" },
  migration_complete: { Icon: Wrench, iconBg: "bg-[var(--color-status-success-bg)]", iconColor: "text-[var(--color-status-success)]" },
  system_error: { Icon: AlertOctagon, iconBg: "bg-[var(--color-status-error-bg)]", iconColor: "text-[var(--color-status-error)]" },
};

/** Default style for unknown notification types */
export const FALLBACK_STYLE: NotificationTypeStyle = {
  Icon: Bell,
  iconBg: "bg-[var(--color-dropdown-hover)]",
  iconColor: "text-[var(--color-text-secondary)]",
};
