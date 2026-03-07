import Skeleton, { SkeletonCard } from "@/components/ui/Skeleton";

export default function AdminLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <Skeleton className="h-7 w-44" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
