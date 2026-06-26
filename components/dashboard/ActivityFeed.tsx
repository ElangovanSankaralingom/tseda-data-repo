"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Flame, Trophy, Award, ThumbsUp, PartyPopper, Hand, Activity, X } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { TranslationKey } from "@/lib/i18n";
import ConfettiBurst from "@/components/ui/ConfettiBurst";

type Reaction = "like" | "fire" | "celebrate" | "clap";
const REACTIONS: Reaction[] = ["like", "fire", "celebrate", "clap"];
const REACTION_ICON: Record<Reaction, typeof ThumbsUp> = {
  like: ThumbsUp,
  fire: Flame,
  celebrate: PartyPopper,
  clap: Hand,
};

type FeedEvent = {
  id: string;
  type: "streak_started" | "streak_won" | "milestone";
  actorName: string;
  isSelf: boolean;
  categoryKey: string | null;
  milestone: number | null;
  createdAt: string;
  reactions: Record<string, number>;
  myReactions: Reaction[];
};
type FeedResponse = { data: { enabled: boolean; events: FeedEvent[] } };

const FRESH_WIN_MS = 60_000;

// A single shared clock (ticks every 30s) read via useSyncExternalStore — keeps
// render pure (no Date.now() in render) and avoids set-state-in-effect.
const timeListeners = new Set<() => void>();
let timeValue = Date.now();
let timeTimer: ReturnType<typeof setInterval> | null = null;

function subscribeTime(cb: () => void): () => void {
  timeListeners.add(cb);
  if (timeTimer === null) {
    timeValue = Date.now();
    timeTimer = setInterval(() => {
      timeValue = Date.now();
      timeListeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    timeListeners.delete(cb);
    if (timeListeners.size === 0 && timeTimer !== null) {
      clearInterval(timeTimer);
      timeTimer = null;
    }
  };
}

function useNow(): number {
  return useSyncExternalStore(
    subscribeTime,
    () => timeValue,
    () => 0,
  );
}

function initials(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.slice(0, 2).toUpperCase() : "?";
}

/** Pure (takes `now` so render stays deterministic). */
function relativeLabel(iso: string, now: number, t: (key: TranslationKey) => string): string {
  const diff = now - Date.parse(iso);
  if (now <= 0 || !Number.isFinite(diff)) return "";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t("feed.justNow");
  if (mins < 60) return t("feed.minutesAgo").replace("{n}", String(mins));
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("feed.hoursAgo").replace("{n}", String(hours));
  return t("feed.daysAgo").replace("{n}", String(Math.floor(hours / 24)));
}

const ReactionBar = React.memo(function ReactionBar({
  event,
  onToggle,
}: {
  event: FeedEvent;
  onToggle: (id: string, reaction: Reaction) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {REACTIONS.map((reaction) => {
        const Icon = REACTION_ICON[reaction];
        const count = event.reactions[reaction] ?? 0;
        const mine = event.myReactions.includes(reaction);
        return (
          <button
            key={reaction}
            type="button"
            onClick={() => onToggle(event.id, reaction)}
            aria-pressed={mine}
            aria-label={t(`feed.react.${reaction}` as TranslationKey)}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold transition-all duration-150 active:scale-95 ${
              mine
                ? "border-[var(--color-primary)]/40 text-[var(--color-primary)]"
                : "border-[var(--color-border-default)] bg-[var(--color-surface-inset)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]"
            }`}
            style={mine ? { backgroundColor: "color-mix(in srgb, var(--color-primary) 12%, transparent)" } : undefined}
          >
            <Icon className="size-3.5" />
            {count > 0 && <span className="tabular-nums">{count}</span>}
          </button>
        );
      })}
    </div>
  );
});

const MilestoneCard = React.memo(function MilestoneCard({
  event,
  now,
  canModerate,
  onToggle,
  onRemove,
}: {
  event: FeedEvent;
  now: number;
  canModerate: boolean;
  onToggle: (id: string, reaction: Reaction) => void;
  onRemove: (id: string) => void;
}) {
  const { t, categoryLabel } = useTranslation();

  const isWon = event.type === "streak_won";
  const isMilestone = event.type === "milestone";
  const palette = isWon ? "amber" : isMilestone ? "indigo" : "orange";
  const accentFg = `var(--color-palette-${palette}-fg)`;
  const accentBg = `var(--color-palette-${palette}-bg)`;
  const accentBorder = `var(--color-palette-${palette}-border)`;
  const TypeIcon = isWon ? Trophy : isMilestone ? Award : Flame;
  const message = isWon
    ? t("feed.wonStreak")
    : isMilestone
      ? t("feed.milestoneReached").replace("{n}", String(event.milestone ?? 0))
      : t("feed.startedStreak");
  const name = event.isSelf ? t("feed.you") : event.actorName;
  const celebratory = isWon || isMilestone;
  const freshWin = celebratory && now > 0 && now - Date.parse(event.createdAt) < FRESH_WIN_MS;

  return (
    <div
      className="relative mb-4 break-inside-avoid overflow-hidden rounded-2xl border bg-[var(--color-card-bg)] p-4 animate-fade-in-up"
      style={{ borderColor: accentBorder, boxShadow: "0 6px 16px -12px rgba(10,16,42,0.18)" }}
    >
      {freshWin && <ConfettiBurst active />}
      <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: accentFg, opacity: 0.85 }} />
      {canModerate && (
        <button
          type="button"
          onClick={() => onRemove(event.id)}
          aria-label={t("feed.remove")}
          className="absolute right-2 top-2 z-10 rounded-full p-1 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-status-error-bg)] hover:text-[var(--color-status-error)]"
        >
          <X className="size-3.5" />
        </button>
      )}

      <div className="flex items-start gap-3 pt-1">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
          style={{ backgroundColor: accentBg, color: accentFg }}
        >
          {initials(name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <TypeIcon className="size-4 shrink-0" style={{ color: accentFg }} />
            <span className="truncate text-sm font-bold text-[var(--color-text-primary)]">{name}</span>
          </div>
          <div className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{message}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-text-tertiary)]">
            {event.categoryKey && (
              <span className="rounded-full px-2 py-0.5 font-medium" style={{ backgroundColor: accentBg, color: accentFg }}>
                {categoryLabel(event.categoryKey)}
              </span>
            )}
            <span>{relativeLabel(event.createdAt, now, t)}</span>
          </div>
        </div>
      </div>

      <ReactionBar event={event} onToggle={onToggle} />
    </div>
  );
});

export default function ActivityFeed({ canModerate = false }: { canModerate?: boolean }) {
  const { t } = useTranslation();
  const { data, mutate } = useApi<FeedResponse>("/api/feed", { refreshInterval: 20_000 });
  const [overrides, setOverrides] = useState<
    Record<string, { reactions: Record<string, number>; myReactions: Reaction[] }>
  >({});
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const now = useNow();

  const events = useMemo(() => {
    const base = data?.data?.events ?? [];
    return base
      .filter((e) => !removedIds.has(e.id))
      .map((e) => (overrides[e.id] ? { ...e, ...overrides[e.id] } : e));
  }, [data, overrides, removedIds]);

  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const enabled = data?.data?.enabled ?? true;

  const onToggle = useCallback(
    async (id: string, reaction: Reaction) => {
      const current = eventsRef.current.find((e) => e.id === id);
      if (!current) return;

      const mine = new Set(current.myReactions);
      const reactions = { ...current.reactions };
      if (mine.has(reaction)) {
        mine.delete(reaction);
        reactions[reaction] = Math.max(0, (reactions[reaction] ?? 0) - 1);
      } else {
        mine.add(reaction);
        reactions[reaction] = (reactions[reaction] ?? 0) + 1;
      }
      setOverrides((prev) => ({ ...prev, [id]: { reactions, myReactions: Array.from(mine) } }));

      try {
        const res = await fetch("/api/feed/react", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId: id, reaction }),
        });
        if (res.ok) {
          const body = (await res.json()) as {
            data?: { id: string; reactions: Record<string, number>; myReactions: Reaction[] };
          };
          if (body.data) {
            setOverrides((prev) => ({
              ...prev,
              [id]: { reactions: body.data!.reactions, myReactions: body.data!.myReactions },
            }));
          }
        } else {
          void mutate();
        }
      } catch {
        void mutate();
      }
    },
    [mutate],
  );

  const onRemove = useCallback(
    async (id: string) => {
      setRemovedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      try {
        await fetch("/api/feed", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId: id }),
        });
      } finally {
        void mutate();
      }
    },
    [mutate],
  );

  if (!enabled) return null;

  return (
    <section className="mt-8" aria-label={t("feed.title")}>
      <div className="mb-4 flex items-center gap-2.5">
        <Activity className="size-4 text-[var(--color-primary)]" />
        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
          {t("feed.title")}
        </h2>
        <span className="size-1.5 rounded-full bg-[var(--color-status-success)] animate-subtle-pulse" />
        <span className="text-[11px] font-medium text-[var(--color-status-success)]/70">{t("feed.live")}</span>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border-default)] bg-[var(--color-surface-inset)] px-5 py-8 text-center text-sm text-[var(--color-text-secondary)]">
          {t("feed.empty")}
        </div>
      ) : (
        <div className="gap-4 [column-fill:balance] sm:columns-2 lg:columns-3">
          {events.map((event) => (
            <MilestoneCard
              key={event.id}
              event={event}
              now={now}
              canModerate={canModerate}
              onToggle={onToggle}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </section>
  );
}
