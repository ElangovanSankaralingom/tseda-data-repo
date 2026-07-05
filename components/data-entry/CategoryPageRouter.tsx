"use client";

import { lazy, Suspense } from "react";
import { notFound } from "next/navigation";
import { isValidCategorySlug } from "@/data/categoryRegistry";
import type { CategoryAdapterPageProps } from "@/components/data-entry/adapters/types";
import EntryListSkeleton from "@/components/data-entry/EntryListSkeleton";

type AdapterComponent = React.ComponentType<CategoryAdapterPageProps>;

const ADAPTER_MAP: Record<string, React.LazyExoticComponent<AdapterComponent>> = {
  "fdp-attended": lazy(() => import("@/components/data-entry/adapters/fdp-attended")),
  "fdp-conducted": lazy(() => import("@/components/data-entry/adapters/fdp-conducted")),
  "case-studies": lazy(() => import("@/components/data-entry/adapters/case-studies")),
  "guest-lectures": lazy(() => import("@/components/data-entry/adapters/guest-lectures")),
  workshops: lazy(() => import("@/components/data-entry/adapters/workshops")),
  "journal-publications": lazy(() => import("@/components/data-entry/adapters/journal-publications")),
  "conference-publications": lazy(() => import("@/components/data-entry/adapters/conference-publications")),
  "books-and-chapters": lazy(() => import("@/components/data-entry/adapters/books-and-chapters")),
  patents: lazy(() => import("@/components/data-entry/adapters/patents")),
  "research-funding": lazy(() => import("@/components/data-entry/adapters/research-funding")),
  "editorial-roles": lazy(() => import("@/components/data-entry/adapters/editorial-roles")),
  "conferences-organized": lazy(() => import("@/components/data-entry/adapters/conferences-organized")),
  "studio-contributions": lazy(() => import("@/components/data-entry/adapters/studio-contributions")),
};

export default function CategoryPageRouter({
  category,
  ...props
}: CategoryAdapterPageProps & { category: string }) {
  if (!isValidCategorySlug(category)) notFound();

  const Adapter = ADAPTER_MAP[category];
  if (!Adapter) notFound();

  return (
    <Suspense fallback={<EntryListSkeleton />}>
      <Adapter {...props} />
    </Suspense>
  );
}
