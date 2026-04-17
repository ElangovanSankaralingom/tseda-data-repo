"use client";

import { Fragment, memo } from "react";
import {
  Calendar,
  Clock,
  Globe,
  GraduationCap,
  MapPin,
  FileText,
  Banknote,
  Shield,
} from "lucide-react";
import type { EntryListGroup } from "@/lib/entryCategorization";

/*
  ─────────────────────────────────────────────────────────
   ENTRY METADATA DISPLAY — ZONE-AWARE visual system

   Active zones (streak_runners, on_the_clock, unlocked):
     BOLD CHIP TAGS — vibrant per-type rainbow colors,
     generous padding, rounded-lg, font-medium.
     These float directly on the dark card surface
     (no inner panel box wrapping them).

   Sealed zone (locked_in):
     FLAT INLINE TEXT — no backgrounds, no borders.
     Just icon + text in muted green, separated by dots.
     Compact, archival, ledger-style. Instantly different
     from the vibrant active pills.

  ─────────────────────────────────────────────────────────
*/

export type PillVariant = "active" | "sealed";

function groupToVariant(group?: EntryListGroup): PillVariant {
  if (group === "locked_in") return "sealed";
  return "active";
}

/* ── ACTIVE palette — BOLD per-type semantic colors ──
   These need to POP against the dark card surface.
   Stronger tints, vivid icon colors. Each type is
   instantly recognizable by color alone.
*/
const ACTIVE_TINTS: Record<string, { tint: string; iconColor: string; textColor: string }> = {
  year:     { tint: "rgba(59,130,246,0.18)",  iconColor: "text-blue-400",    textColor: "text-blue-200/70" },
  semester: { tint: "rgba(168,85,247,0.18)",  iconColor: "text-purple-400",  textColor: "text-purple-200/70" },
  level:    { tint: "rgba(34,197,94,0.18)",   iconColor: "text-emerald-400", textColor: "text-emerald-200/70" },
  mode:     { tint: "rgba(249,115,22,0.18)",  iconColor: "text-orange-400",  textColor: "text-orange-200/70" },
  date:     { tint: "var(--color-border-subtle)",    iconColor: "text-slate-400",   textColor: "text-slate-300/70" },
  duration: { tint: "rgba(251,191,36,0.18)",         iconColor: "text-amber-400",   textColor: "text-amber-200/70" },
  funding:  { tint: "rgba(34,197,94,0.18)",          iconColor: "text-emerald-400", textColor: "text-emerald-200/70" },
  default:  { tint: "var(--color-border-subtle)",    iconColor: "text-slate-400",   textColor: "text-slate-300/70" },
};

/** Classify a metadata part to assign an icon and semantic type */
function classifyPart(part: string): { icon: React.ElementType; type: string } {
  const lower = part.toLowerCase();

  if (lower.includes("academic") || lower.includes("year") || /^\d{4}/.test(lower)) {
    return { icon: Calendar, type: "year" };
  }
  if (lower.includes("semester") || lower.includes("odd") || lower.includes("even")) {
    return { icon: GraduationCap, type: "semester" };
  }
  if (lower.includes("national") || lower.includes("international") || lower.includes("state") || lower.includes("regional") || lower.includes("college")) {
    return { icon: Globe, type: "level" };
  }
  if (lower.includes("online") || lower.includes("offline") || lower.includes("hybrid")) {
    return { icon: MapPin, type: "mode" };
  }
  if (part.includes("–") || /\d+\/\d+\/\d+/.test(part)) {
    return { icon: Calendar, type: "date" };
  }
  if (lower.includes("day") || lower.includes("hour")) {
    return { icon: Clock, type: "duration" };
  }
  if (lower.includes("funded") || lower.includes("₹") || lower.includes("$")) {
    return { icon: Banknote, type: "funding" };
  }
  return { icon: FileText, type: "default" };
}

/** A single metadata element — COMPLETELY different per variant */
const MetadataPill = memo(function MetadataPill({
  text,
  variant,
}: {
  text: string;
  variant: PillVariant;
}) {
  const { icon: Icon, type } = classifyPart(text);

  /* ── SEALED: flat inline text, no box, no background ── */
  if (variant === "sealed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-white/40">
        <Icon className="size-3 shrink-0 text-emerald-400/50" />
        <span className="truncate max-w-[180px]">{text}</span>
      </span>
    );
  }

  /* ── ACTIVE: bold chip tag with vibrant tint — each type has its OWN color ── */
  const { tint, iconColor, textColor } = ACTIVE_TINTS[type] || ACTIVE_TINTS.default;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${textColor}`}
      style={{
        background: tint,
        border: "1px solid var(--color-border-subtle)",
      }}
    >
      <Icon className={`size-3 shrink-0 ${iconColor}`} />
      <span className="truncate max-w-[180px]">{text}</span>
    </span>
  );
});

/** Render metadata — chips for active, inline text for sealed */
export const MetadataPills = memo(function MetadataPills({
  parts,
  group,
}: {
  parts: string[];
  group?: EntryListGroup;
}) {
  if (parts.length === 0) return null;
  const variant = groupToVariant(group);

  /* ── SEALED: flowing inline text with dot separators ── */
  if (variant === "sealed") {
    return (
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {parts.map((part, i) => (
          <Fragment key={i}>
            <MetadataPill text={part} variant="sealed" />
            {i < parts.length - 1 && (
              <span className="text-emerald-400/30 text-xs select-none">·</span>
            )}
          </Fragment>
        ))}
      </div>
    );
  }

  /* ── ACTIVE: chip tags in a flex wrap ── */
  return (
    <div className="flex flex-wrap gap-1.5">
      {parts.map((part, i) => (
        <MetadataPill key={i} text={part} variant={variant} />
      ))}
    </div>
  );
});

/** File attachment badge */
type AttachmentFile = {
  storedPath: string;
  url: string;
};

const AttachmentBadge = memo(function AttachmentBadge({
  label,
  files,
  variant,
}: {
  label: string;
  files: AttachmentFile[];
  variant: PillVariant;
}) {
  if (files.length === 0) return null;

  /* ── SEALED: flat inline text links, no box ── */
  if (variant === "sealed") {
    return (
      <>
        {files.map((meta, i) => (
          <a
            key={meta.storedPath}
            className="inline-flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors"
            href={meta.url}
            target="_blank"
            rel="noreferrer"
          >
            <Shield className="size-3 shrink-0 text-emerald-400/40" />
            {label}{files.length > 1 ? ` ${i + 1}` : ""}
          </a>
        ))}
      </>
    );
  }

  /* ── ACTIVE: bold chip badges ── */
  return (
    <>
      {files.map((meta, i) => (
        <a
          key={meta.storedPath}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium text-white/60 hover:text-white/80 transition-colors"
          style={{
            background: "var(--color-surface-raised)",
            border: "1px solid var(--color-border-subtle)",
          }}
          href={meta.url}
          target="_blank"
          rel="noreferrer"
        >
          <FileText className="size-3 shrink-0 opacity-50" />
          {label}{files.length > 1 ? ` ${i + 1}` : ""}
        </a>
      ))}
    </>
  );
});

/** Render attachment links — zone-aware */
export const AttachmentBadges = memo(function AttachmentBadges({
  attachments,
  group,
}: {
  attachments: { label: string; files: AttachmentFile[] }[];
  group?: EntryListGroup;
}) {
  const hasAny = attachments.some(a => a.files.length > 0);
  if (!hasAny) return null;
  const variant = groupToVariant(group);

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {attachments.map((att) => (
        <AttachmentBadge key={att.label} label={att.label} files={att.files} variant={variant} />
      ))}
    </div>
  );
});
