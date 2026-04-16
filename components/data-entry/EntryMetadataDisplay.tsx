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
} from "lucide-react";

/*
  ─────────────────────────────────────────────────────────
   ENTRY METADATA DISPLAY — Visual pills instead of plain text

   Instead of:
     "Academic Year 2025–2026 • EVEN Semester • National • Online • 3/28 – 3/29 • 2 days"

   We get:
     [📅 2025–2026] [🎓 EVEN] [🌐 National] [📍 Online] [🕐 3/28–3/29] [⏱ 2 days]

   Each pill has a subtle icon and category-appropriate color tint.
   Attachments get file-badge treatment with icons.
  ─────────────────────────────────────────────────────────
*/

/** Classify a metadata part to assign an icon and color */
function classifyPart(part: string): { icon: React.ElementType; tint: string } {
  const lower = part.toLowerCase();

  // Academic year
  if (lower.includes("academic") || lower.includes("year") || /^\d{4}/.test(lower)) {
    return { icon: Calendar, tint: "rgba(59,130,246,0.12)" };
  }
  // Semester
  if (lower.includes("semester") || lower.includes("odd") || lower.includes("even")) {
    return { icon: GraduationCap, tint: "rgba(168,85,247,0.12)" };
  }
  // Level (national, international, state, etc.)
  if (lower.includes("national") || lower.includes("international") || lower.includes("state") || lower.includes("regional") || lower.includes("college")) {
    return { icon: Globe, tint: "rgba(34,197,94,0.12)" };
  }
  // Mode (online, offline, hybrid)
  if (lower.includes("online") || lower.includes("offline") || lower.includes("hybrid")) {
    return { icon: MapPin, tint: "rgba(249,115,22,0.12)" };
  }
  // Date range (contains – or / pattern)
  if (part.includes("–") || /\d+\/\d+\/\d+/.test(part)) {
    return { icon: Calendar, tint: "rgba(255,255,255,0.05)" };
  }
  // Duration (days)
  if (lower.includes("day") || lower.includes("hour")) {
    return { icon: Clock, tint: "rgba(251,191,36,0.12)" };
  }
  // Funding
  if (lower.includes("funded") || lower.includes("₹") || lower.includes("$")) {
    return { icon: Banknote, tint: "rgba(34,197,94,0.12)" };
  }
  // Default
  return { icon: FileText, tint: "rgba(255,255,255,0.05)" };
}

/** A single metadata pill with icon */
const MetadataPill = memo(function MetadataPill({ text }: { text: string }) {
  const { icon: Icon, tint } = classifyPart(text);

  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-white/50"
      style={{
        background: tint,
        border: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <Icon className="size-2.5 shrink-0 opacity-50" />
      <span className="truncate max-w-[180px]">{text}</span>
    </span>
  );
});

/** Render metadata parts as visual pills */
export const MetadataPills = memo(function MetadataPills({ parts }: { parts: string[] }) {
  if (parts.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {parts.map((part, i) => (
        <MetadataPill key={i} text={part} />
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
}: {
  label: string;
  files: AttachmentFile[];
}) {
  if (files.length === 0) return null;

  return (
    <>
      {files.map((meta, i) => (
        <a
          key={meta.storedPath}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium text-white/60 hover:text-white/80 transition-colors"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
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

/** Render attachment links as file badges */
export const AttachmentBadges = memo(function AttachmentBadges({
  attachments,
}: {
  attachments: { label: string; files: AttachmentFile[] }[];
}) {
  const hasAny = attachments.some(a => a.files.length > 0);
  if (!hasAny) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {attachments.map((att) => (
        <AttachmentBadge key={att.label} label={att.label} files={att.files} />
      ))}
    </div>
  );
});
