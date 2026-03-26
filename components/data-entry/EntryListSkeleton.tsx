"use client";

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="h-3.5 w-3.5 rounded-full bg-[var(--color-card-border)]" />
        <div className="h-4 w-40 rounded bg-[var(--color-card-border)]" />
        <div className="h-5 w-16 rounded-full bg-[var(--color-dropdown-hover)]" />
      </div>
      <div className="mt-2 pl-5.5">
        <div className="h-3 w-56 rounded bg-[var(--color-dropdown-hover)]" />
      </div>
      <div className="mt-3 border-t border-[var(--color-divider)] pt-2.5">
        <div className="h-3 w-24 rounded bg-[var(--color-dropdown-hover)]" />
      </div>
    </div>
  );
}

export default function EntryListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
