"use client";

import { memo } from "react";
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
   ENTRY METADATA DISPLAY — ZONE-AWARE visual pills

   Active zones (streak_runners, on_the_clock, unlocked):
     Rainbow semantic colors — each type gets its own tint.
     [📅 blue] [🎓 purple] [🌐 green] [📍 orange]

   Sealed zone (locked_in):
     Monochrome green — ALL pills use green-family tint.
     More compact, desaturated, "archived record" feeling.
     [📅 green] [🎓 green] [🌐 green] [📍 green]

   This makes the two zones INSTANTLY distinguishable —
   not by the wrapper, but by the actual content inside.
  ─────────────────────────────────────────────────────────
*/

export type PillVariant = "active" | "sealed";

function groupToVariant(group?: EntryListGroup): PillVariant {
  if (group === "locked_in") return "sealed";
  return "active";
}

/* ── ACTIVE palette — per-type semantic colors ── */
const ACTIVE_TINTS: Record<string, { tint: string; iconColor: string }> = {
  year:     { tint: "rgba(59,130,246,0.12)",  iconColor: "text-blue-400/60" },
  semester: { tint: "rgba(168,85,247,0.12)",  iconColor: "text-purple-400/60" },
  level:    { tint: "rgba(34,197,94,0.12)",   iconColor: "text-emerald-400/60" },
  mode:     { tint: "rgba(249,115,22,0.12)",  iconColor: "text-orange-400/60" },
  date:     { tint: "rgba(255,255,255,0.05)", iconColor: "text-white/40" },
  duration: { tint: "rgba(251,191,36,0.12)",  iconColor: "text-amber-400/60" },
  funding:  { tint: "rgba(34,197,94,0.12)",   iconColor: "text-emerald-400/60" },
  default:  { tint: "rgba(255,255,255,0.05)", iconColor: "text-white/40" },
};

/* ── SEALED palette — monochrome green family ── */
const SEALED_TINTS: Record<string, { tint: string; iconColor: string }> = {
  year:     { tint: "rgba(34,197,94,0.06)",  iconColor: "text-emerald-500/40" },
  semester: { tint: "rgba(34,197,94,0.06)",  iconColor: "text-emerald-500/40" },
  level:    { tint: "rgba(34,197,94,0.08)",  iconColor: "text-emerald-500/40" },
  mode:     { tint: "rgba(34,197,94,0.06)",  iconColor: "text-emerald-500/40" },
  date:     { tint: "rgba(34,197,94,0.04)",  iconColor: "text-emerald-500/30" },
  duration: { tint: "rgba(34,197,94,0.06)",  iconColor: "text-emerald-500/40" },
  funding:  { tint: "rgba(34,197,94,0.08)",  iconColor: "text-emerald-500/40" },
  default:  { tint: "rgba(34,197,94,0.04)",  iconColor: "text-emerald-500/30" },
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

/** A single metadata pill — style changes based on variant */
const MetadataPill = memo(function MetadataPill({
  text,
  variant,
}: {
  text: string;
  variant: PillVariant;
}) {
  const { icon: Icon, type } = classifyPart(text);
  const palette = variant === "sealed" ? SEALED_TINTS : ACTIVE_TINTS;
  const { tint, iconColor } = palette[type] || palette.default;
  const isSealed = variant === "sealed";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] ${
        isSealed ? "text-emerald-300/40" : "text-white/50"
      }`}
      style={{
        background: tint,
        border: `1px solid ${isSealed ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.04)"}`,
      }}
    >
      <Icon className={`size-2.5 shrink-0 ${iconColor}`} />
      <span className="truncate max-w-[180px]">{text}</span>
    </span>
  );
});

/** Render metadata parts as visual pills — zone-aware */
export const MetadataPills = memo(function MetadataPills({
  parts,
  group,
}: {
  parts: string[];
  group?: EntryListGroup;
}) {
  if (parts.length === 0) return null;
  const variant = groupToVariant(group);

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
  const isSealed = variant === "sealed";

  return (
    <>
      {files.map((meta, i) => (
        <a
          key={meta.storedPath}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
            isSealed
              ? "text-emerald-400/50 hover:text-emerald-300/70"
              : "text-white/60 hover:text-white/80"
          }`}
          style={{
            background: isSealed ? "rgba(34,197,94,0.05)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${isSealed ? "rgba(34,197,94,0.10)" : "rgba(255,255,255,0.06)"}`,
          }}
          href={meta.url}
          target="_blank"
          rel="noreferrer"
        >
          {isSealed
            ? <Shield className="size-3 shrink-0 text-emerald-500/40" />
            : <FileText className="size-3 shrink-0 opacity-50" />
          }
          {label}{files.length > 1 ? ` ${i + 1}` : ""}
        </a>
      ))}
    </>
  );
});

/** Render attachment links as file badges — zone-aware */
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
