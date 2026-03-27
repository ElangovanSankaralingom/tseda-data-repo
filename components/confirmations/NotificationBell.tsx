"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import type { PersistentNotification } from "@/lib/confirmations/types";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { USER_NOTIFICATION_STYLES, FALLBACK_STYLE } from "@/data/notificationTypeConfig";

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
  const { t } = useTranslation();
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
        className={`relative flex size-9 items-center justify-center rounded-xl transition-colors ${unreadCount > 0 ? "hover:bg-blue-500/10" : "hover:bg-[var(--color-dropdown-hover)]"}`}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className={`size-5 ${unreadCount > 0 ? "text-[var(--color-text-secondary)] fill-[var(--color-text-secondary)]" : "text-[var(--color-text-muted)]"}`} />
        {unreadCount > 0 && (
          <span className={`absolute -right-0.5 -top-0.5 flex items-center justify-center rounded-full bg-red-500/15 font-bold text-white ring-2 ring-[var(--color-card-bg)] animate-subtle-pulse ${
            unreadCount >= 10 ? "min-w-5 h-4.5 px-1 text-[8px]" : "size-4.5 text-[10px]"
          }`}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-[70vh] overflow-hidden rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] shadow-2xl animate-scale-in max-sm:fixed max-sm:inset-x-4 max-sm:right-auto max-sm:w-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--color-divider)] px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{t('notification.title')}</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-700">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                {t('notification.markAllRead')}
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[calc(70vh-52px)]">
            {notifications.length === 0 && loaded && (
              <div className="flex flex-col items-center justify-center py-12">
                <Bell className="size-8 text-[var(--color-text-muted)] mb-3" />
                <div className="text-sm font-medium text-[var(--color-text-secondary)]">{t('notification.noNotifications')}</div>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)] text-center px-8">
                  {t('notification.noNotificationsHint')}
                </p>
              </div>
            )}
            {notifications.map((n) => {
              const conf = USER_NOTIFICATION_STYLES[n.type] ?? FALLBACK_STYLE;
              const NIcon = conf.Icon;
              return (
                <div
                  key={n.id}
                  className={`border-b border-[var(--color-divider)] px-4 py-3 transition-colors hover:bg-[var(--color-dropdown-hover)] ${
                    !n.read ? "bg-blue-500/10 border-l-3 border-l-blue-500" : ""
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
        <div className="text-sm font-semibold text-[var(--color-text-primary)]">{n.title}</div>
        {!n.read && <span className="mt-1 size-2.5 shrink-0 rounded-full bg-blue-500/15" />}
      </div>
      <p className="mt-0.5 text-xs text-[var(--color-text-secondary)] line-clamp-2">{n.message}</p>
      <span className="mt-1 text-xs text-[var(--color-text-secondary)]">{formatRelative(n.createdAt)}</span>
    </div>
  );
}
