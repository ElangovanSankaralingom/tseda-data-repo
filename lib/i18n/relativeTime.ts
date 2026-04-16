import { t, type Language } from "./index";
import { formatDate } from "./locale";

/**
 * Format a date as a human-readable relative time string using the i18n system.
 *
 * Returns strings like "Just now", "5m ago", "3h ago", "2d ago" in the
 * active language. Falls back to a short date for anything older than 30 days.
 */
export function formatRelativeTime(
  value: string | undefined,
  language: Language,
): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return t("time.justNow", language);
  if (minutes < 60) return t("time.minuteAgo", language).replace("{n}", String(minutes));

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("time.hourAgo", language).replace("{n}", String(hours));

  const days = Math.floor(hours / 24);
  if (days < 30) return t("time.dayAgo", language).replace("{n}", String(days));

  return formatDate(date, language, { day: "numeric", month: "short" });
}
