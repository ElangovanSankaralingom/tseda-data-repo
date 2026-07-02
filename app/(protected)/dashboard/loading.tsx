import Skeleton, { SkeletonCard } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 animate-fade-in-up">
      <Skeleton className="h-7 w-48" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`animate-fade-in-up stagger-${i}`}>
            <SkeletonCard />
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`animate-fade-in-up stagger-${i + 3}`}>
            <SkeletonCard />
          </div>
        ))}
      </div>
    </div>
  );
}
