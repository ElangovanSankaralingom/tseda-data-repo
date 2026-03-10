"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertOctagon,
  FileEdit,
  HardDrive,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
  Wrench,
} from "lucide-react";
import type { AdminNotification, AdminNotificationType } from "@/lib/confirmations/types";

const TYPE_CONFIG: Record<
  AdminNotificationType,
  { Icon: typeof Shield; iconBg: string; iconColor: string }
> = {
  edit_request: { Icon: FileEdit, iconBg: "bg-purple-100", iconColor: "text-purple-600" },
  delete_request: { Icon: Trash2, iconBg: "bg-red-100", iconColor: "text-red-600" },
  pending_requests_reminder: { Icon: FileEdit, iconBg: "bg-purple-100", iconColor: "text-purple-600" },
  backup_overdue: { Icon: ShieldAlert, iconBg: "bg-amber-100", iconColor: "text-amber-600" },
  integrity_issues: { Icon: ShieldCheck, iconBg: "bg-red-100", iconColor: "text-red-600" },
  wal_warning: { Icon: HardDrive, iconBg: "bg-amber-100", iconColor: "text-amber-600" },
  new_user: { Icon: UserPlus, iconBg: "bg-blue-100", iconColor: "text-blue-600" },
  user_status_change: { Icon: UserPlus, iconBg: "bg-slate-100", iconColor: "text-slate-600" },
  settings_changed: { Icon: Settings, iconBg: "bg-slate-100", iconColor: "text-slate-600" },
  migration_complete: { Icon: Wrench, iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
  system_error: { Icon: AlertOctagon, iconBg: "bg-red-100", iconColor: "text-red-600" },
};

function formatRelative(ts: string): string {
  const diff = Date.now() - Date.parse(ts);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

import { type AdminNotificationWithRead } from "./confirmTypes";

export default function AdminNotificationBell({
  onPanelToggle,
  forceClose,
}: {
  onPanelToggle?: (isOpen: boolean) => void;
  forceClose?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotificationWithRead[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [, setViewerEmail] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  // Force close from parent (when user bell opens)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (forceClose && open) setOpen(false);
  }, [forceClose, open]);

  // Fetch unread count on mount and periodically
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications/unread-count", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { count: number };
        setUnreadCount(data.count);
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchUnreadCount();
    const interval = setInterval(() => void fetchUnreadCount(), 60_000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Fetch full list when panel opens
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { notifications: AdminNotification[]; viewerEmail: string };
        setViewerEmail(data.viewerEmail);
        setNotifications(
          data.notifications.map((n) => ({
            ...n,
            read: n.readBy.includes(data.viewerEmail),
          })),
        );
        setLoaded(true);
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    if (open && !loaded) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchNotifications();
    }
  }, [open, loaded, fetchNotifications]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  // Notify parent of panel state
  useEffect(() => {
    onPanelToggle?.(open);
  }, [open, onPanelToggle]);

  const markAllRead = useCallback(async () => {
    try {
      await fetch("/api/admin/notifications/read-all", { method: "PUT" });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  }, []);

  const markRead = useCallback(async (id: string) => {
    try {
      await fetch(`/api/admin/notifications/${id}/read`, { method: "PUT" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently fail
    }
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const dismiss = useCallback(async (id: string) => {
    try {
      await fetch(`/api/admin/notifications/${id}`, { method: "DELETE" });
      const was = notifications.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (was && !was.read) setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently fail
    }
  }, [notifications]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) setLoaded(false);
        }}
        className="relative flex size-9 items-center justify-center rounded-xl transition-colors hover:bg-indigo-50"
        aria-label={`Admin Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        title="Admin Notifications"
      >
        <ShieldAlert className="size-[18px] text-indigo-500 transition-colors hover:text-indigo-700" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white ring-2 ring-white animate-subtle-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[420px] max-h-[70vh] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl animate-scale-in max-sm:fixed max-sm:inset-x-4 max-sm:right-auto max-sm:w-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-indigo-100 bg-indigo-50/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-900">Admin Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[calc(70vh-52px)]">
            {notifications.length === 0 && loaded && (
              <div className="flex flex-col items-center justify-center py-12">
                <ShieldAlert className="size-8 text-indigo-200 mb-3" />
                <div className="text-sm font-medium text-slate-500">No admin alerts</div>
                <p className="mt-1 text-xs text-slate-500">Everything&apos;s running smooth</p>
              </div>
            )}
            {notifications.map((n) => {
              const conf = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.system_error;
              const NIcon = conf.Icon;
              return (
                <div
                  key={n.id}
                  className={`border-b border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50 ${
                    !n.read ? "bg-indigo-50/50" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${conf.iconBg}`}>
                      <NIcon className={`size-4 ${conf.iconColor}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-900">{n.title}</div>
                        {!n.read && <span className="mt-1 size-2 shrink-0 rounded-full bg-indigo-500" />}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{n.message}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-xs text-slate-500">{formatRelative(n.createdAt)}</span>
                        {n.actionUrl && n.actionLabel && (
                          <Link
                            href={n.actionUrl}
                            onClick={() => {
                              if (!n.read) void markRead(n.id);
                              setOpen(false);
                            }}
                            className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-100 hover:text-indigo-700"
                          >
                            {n.actionLabel}
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
