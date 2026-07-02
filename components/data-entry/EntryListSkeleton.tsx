"use client";

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-sm p-4">
      <div className="flex items-center gap-2">
        <div className="h-3.5 w-3.5 rounded-full bg-[var(--color-glass-border)]" />
        <div className="h-4 w-40 rounded bg-[var(--color-glass-border)]" />
        <div className="h-5 w-16 rounded-full bg-[var(--color-glass-hover)]" />
      </div>
      <div className="mt-2 pl-5.5">
        <div className="h-3 w-56 rounded bg-[var(--color-glass-hover)]" />
      </div>
      <div className="mt-3 border-t border-[var(--color-glass-border)] pt-2.5">
        <div className="h-3 w-24 rounded bg-[var(--color-glass-hover)]" />
      </div>
    </div>
  );
}

export default function EntryListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        // Staggered fade on a wrapper (the card itself pulses) so the list
        // materializes instead of popping in.
        <div key={i} className={`animate-fade-in-up stagger-${Math.min(i + 1, 12)}`}>
          <SkeletonCard />
        </div>
      ))}
    </div>
  );
}
