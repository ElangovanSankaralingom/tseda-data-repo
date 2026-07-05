"use client";

import { lazy, Suspense } from "react";
import { notFound } from "next/navigation";
import { isValidCategorySlug } from "@/data/categoryRegistry";
import type { CategoryAdapterPageProps } from "@/components/data-entry/adapters/types";
import EntryListSkeleton from "@/components/data-entry/EntryListSkeleton";

type AdapterComponent = React.ComponentType<CategoryAdapterPageProps>;
type AdapterLoader = () => Promise<{ default: AdapterComponent }>;

/**
 * One loader per category — shared by the lazy components AND the idle
 * prefetcher, so a chunk downloaded on the dashboard is instantly reused
 * when the category page mounts (kills the "loads twice" flash).
 */
const ADAPTER_LOADERS: Record<string, AdapterLoader> = {
  "fdp-attended": () => import("@/components/data-entry/adapters/fdp-attended"),
  "fdp-conducted": () => import("@/components/data-entry/adapters/fdp-conducted"),
  "case-studies": () => import("@/components/data-entry/adapters/case-studies"),
  "guest-lectures": () => import("@/components/data-entry/adapters/guest-lectures"),
  workshops: () => import("@/components/data-entry/adapters/workshops"),
  "journal-publications": () => import("@/components/data-entry/adapters/journal-publications"),
  "conference-publications": () => import("@/components/data-entry/adapters/conference-publications"),
  "books-and-chapters": () => import("@/components/data-entry/adapters/books-and-chapters"),
  patents: () => import("@/components/data-entry/adapters/patents"),
  "research-funding": () => import("@/components/data-entry/adapters/research-funding"),
  "editorial-roles": () => import("@/components/data-entry/adapters/editorial-roles"),
  "conferences-organized": () => import("@/components/data-entry/adapters/conferences-organized"),
  "studio-contributions": () => import("@/components/data-entry/adapters/studio-contributions"),
  "creative-publications": () => import("@/components/data-entry/adapters/creative-publications"),
  "design-competitions": () => import("@/components/data-entry/adapters/design-competitions"),
  "exhibitions-outreach": () => import("@/components/data-entry/adapters/exhibitions-outreach"),
  "online-courses": () => import("@/components/data-entry/adapters/online-courses"),
  "mentoring-programs": () => import("@/components/data-entry/adapters/mentoring-programs"),
  "student-placements": () => import("@/components/data-entry/adapters/student-placements"),
  "student-higher-studies": () => import("@/components/data-entry/adapters/student-higher-studies"),
  "student-exams": () => import("@/components/data-entry/adapters/student-exams"),
  "student-awards": () => import("@/components/data-entry/adapters/student-awards"),
};

const ADAPTER_MAP: Record<string, React.LazyExoticComponent<AdapterComponent>> =
  Object.fromEntries(
    Object.entries(ADAPTER_LOADERS).map(([slug, loader]) => [slug, lazy(loader)]),
  );

const preloaded = new Set<string>();

/** Idle-prefetch an adapter chunk (safe to call repeatedly). */
export function preloadCategoryAdapter(slug: string): void {
  if (preloaded.has(slug)) return;
  const loader = ADAPTER_LOADERS[slug];
  if (!loader) return;
  preloaded.add(slug);
  void loader().catch(() => {
    preloaded.delete(slug); // allow a retry after a transient failure
  });
}

/** Prefetch every visible category's adapter during browser idle time. */
export function preloadCategoryAdapters(slugs: readonly string[]): void {
  if (typeof window === "undefined") return;
  const run = () => slugs.forEach(preloadCategoryAdapter);
  if ("requestIdleCallback" in window) {
    (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(run);
  } else {
    setTimeout(run, 800);
  }
}

/** Full-page fallback: header block + cards, so the transition shows ONE
 *  coherent skeleton instead of an empty flash followed by content. */
function CategoryPageFallback() {
  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="animate-pulse space-y-3">
        <div className="h-8 w-64 rounded-lg bg-[var(--color-surface-raised)]" />
        <div className="h-4 w-96 max-w-full rounded bg-[var(--color-surface-inset)]" />
      </div>
      <EntryListSkeleton count={3} />
    </div>
  );
}

export default function CategoryPageRouter({
  category,
  ...props
}: CategoryAdapterPageProps & { category: string }) {
  if (!isValidCategorySlug(category)) notFound();

  const Adapter = ADAPTER_MAP[category];
  if (!Adapter) notFound();

  return (
    <Suspense fallback={<CategoryPageFallback />}>
      <Adapter {...props} />
    </Suspense>
  );
}
