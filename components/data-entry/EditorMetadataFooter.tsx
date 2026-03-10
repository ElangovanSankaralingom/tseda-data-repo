"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

function formatRelative(iso?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default function EditorMetadataFooter({
  entryId,
  createdAt,
  updatedAt,
}: {
  entryId?: string;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
  committedAt?: string;
  streakEligible?: boolean;
  editWindowExpires?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const items: string[] = [];
  if (entryId) items.push(`ID: ${entryId.slice(0, 8)}`);
  const created = formatRelative(createdAt);
  if (created) items.push(`Created: ${created}`);
  const updated = formatRelative(updatedAt);
  if (updated) items.push(`Last updated: ${updated}`);

  if (items.length === 0) return null;

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-500 transition-colors"
      >
        <ChevronDown
          className={`size-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
        Show details
      </button>
      {expanded ? (
        <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
          <p className="text-xs text-slate-600 flex flex-wrap gap-x-1.5">
            {items.map((item, i) => (
              <span key={item}>
                {i > 0 ? <span className="text-slate-400 mr-1.5">&middot;</span> : null}
                {item}
              </span>
            ))}
          </p>
        </div>
      ) : null}
    </div>
  );
}
