import Skeleton, { SkeletonCard } from "@/components/ui/Skeleton";

export default function AdminLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 animate-fade-in-up">
      <Skeleton className="h-7 w-44" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`animate-fade-in-up stagger-${i}`}>
            <SkeletonCard />
          </div>
        ))}
      </div>
    </div>
  );
}
