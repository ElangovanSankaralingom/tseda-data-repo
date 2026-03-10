"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Archive,
  Bell,
  CheckCircle,
  Clock,
  Lock,
  Megaphone,
  Trash2,
  Trophy,
  XCircle,
} from "lucide-react";
import type { PersistentNotification, PersistentNotificationType } from "@/lib/confirmations/types";

const TYPE_CONFIG: Record<
  PersistentNotificationType,
  { Icon: typeof Bell; iconBg: string; iconColor: string }
> = {
  edit_request_granted: { Icon: CheckCircle, iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
  edit_request_rejected: { Icon: XCircle, iconBg: "bg-red-100", iconColor: "text-red-600" },
  delete_approved: { Icon: Trash2, iconBg: "bg-red-100", iconColor: "text-red-600" },
  auto_archived: { Icon: Archive, iconBg: "bg-amber-100", iconColor: "text-amber-600" },
  timer_warning: { Icon: Clock, iconBg: "bg-orange-100", iconColor: "text-orange-600" },
  entry_finalized: { Icon: Lock, iconBg: "bg-slate-100", iconColor: "text-slate-600" },
  streak_won: { Icon: Trophy, iconBg: "bg-amber-100", iconColor: "text-amber-600" },
  system_announcement: { Icon: Megaphone, iconBg: "bg-blue-100", iconColor: "text-blue-600" },
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

export default function NotificationBell({
  onPanelToggle,
  forceClose,
}: {
  onPanelToggle?: (isOpen: boolean) => void;
  forceClose?: boolean;
} = {}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<PersistentNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Force close from parent (when admin bell opens)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (forceClose && open) setOpen(false);
  }, [forceClose, open]);

  // Notify parent of panel state
  useEffect(() => {
    onPanelToggle?.(open);
  }, [open, onPanelToggle]);

  // Fetch unread count on mount and periodically
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/me/notifications/unread-count", { cache: "no-store" });
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
      const res = await fetch("/api/me/notifications", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { notifications: PersistentNotification[] };
        setNotifications(data.notifications);
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

  const markAllRead = useCallback(async () => {
    try {
      await fetch("/api/me/notifications/read-all", { method: "PUT" });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  }, []);

  const markRead = useCallback(async (id: string) => {
    try {
      await fetch(`/api/me/notifications/${id}/read`, { method: "PUT" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently fail
    }
  }, []);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) setLoaded(false); // Refresh on reopen
        }}
        className="relative flex size-9 items-center justify-center rounded-xl transition-colors hover:bg-slate-100"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="size-5 text-slate-500" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white animate-subtle-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-[70vh] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl animate-scale-in max-sm:fixed max-sm:inset-x-4 max-sm:right-auto max-sm:w-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[calc(70vh-52px)]">
            {notifications.length === 0 && loaded && (
              <div className="flex flex-col items-center justify-center py-12">
                <Bell className="size-8 text-slate-300 mb-3" />
                <div className="text-sm font-medium text-slate-500">No notifications yet</div>
                <p className="mt-1 text-xs text-slate-500 text-center px-8">
                  You&apos;ll see updates about your entries and edit requests here
                </p>
              </div>
            )}
            {notifications.map((n) => {
              const conf = TYPE_CONFIG[n.type];
              const NIcon = conf.Icon;
              return (
                <div
                  key={n.id}
                  className={`border-b border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50 ${
                    !n.read ? "bg-blue-50/50" : ""
                  }`}
                >
                  {n.actionUrl ? (
                    <Link
                      href={n.actionUrl}
                      onClick={() => {
                        if (!n.read) void markRead(n.id);
                        setOpen(false);
                      }}
                      className="flex items-start gap-3"
                    >
                      <NotificationIcon Icon={NIcon} iconBg={conf.iconBg} iconColor={conf.iconColor} />
                      <NotificationContent notification={n} />
                    </Link>
                  ) : (
                    <div
                      className="flex items-start gap-3 cursor-pointer"
                      onClick={() => { if (!n.read) void markRead(n.id); }}
                    >
                      <NotificationIcon Icon={NIcon} iconBg={conf.iconBg} iconColor={conf.iconColor} />
                      <NotificationContent notification={n} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationIcon({
  Icon,
  iconBg,
  iconColor,
}: {
  Icon: typeof Bell;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
      <Icon className={`size-4 ${iconColor}`} />
    </div>
  );
}

function NotificationContent({ notification: n }: { notification: PersistentNotification }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-slate-900">{n.title}</div>
        {!n.read && <span className="mt-1 size-2 shrink-0 rounded-full bg-blue-500" />}
      </div>
      <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{n.message}</p>
      <span className="mt-1 text-xs text-slate-500">{formatRelative(n.createdAt)}</span>
    </div>
  );
}
