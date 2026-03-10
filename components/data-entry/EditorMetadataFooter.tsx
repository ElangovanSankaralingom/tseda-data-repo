"use client";


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

function formatDate(iso?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
}

export default function EditorMetadataFooter({
  entryId,
  category,
  createdAt,
  updatedAt,
  committedAt,
  streakEligible,
  editWindowExpires,
}: {
  entryId?: string;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
  committedAt?: string;
  streakEligible?: boolean;
  editWindowExpires?: string;
}) {
  const items: string[] = [];

  if (entryId) items.push(`ID: ${entryId.slice(0, 8)}`);
  if (category) items.push(`Category: ${category}`);

  const created = formatRelative(createdAt);
  if (created) items.push(`Created: ${created}`);

  const updated = formatRelative(updatedAt);
  if (updated) items.push(`Last saved: ${updated}`);

  const committed = formatRelative(committedAt);
  if (committed) items.push(`Generated: ${committed}`);

  if (streakEligible) items.push("Streak eligible: Yes");

  const expires = formatDate(editWindowExpires);
  if (expires) items.push(`Edit window closes: ${expires}`);

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 mt-6">
      <p className="text-xs text-slate-500 flex flex-wrap gap-x-1.5">
        {items.map((item, i) => (
          <span key={item}>
            {i > 0 ? <span className="text-slate-500 mr-1.5">&middot;</span> : null}
            {item}
          </span>
        ))}
      </p>
    </div>
  );
}
