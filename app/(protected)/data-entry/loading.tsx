import Skeleton, { SkeletonCard } from "@/components/ui/Skeleton";

export default function DataEntryLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 animate-fade-in-up">
      <Skeleton className="h-7 w-40" />
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`animate-fade-in-up stagger-${i}`}>
            <SkeletonCard />
          </div>
        ))}
      </div>
    </div>
  );
}
