"use client";

import { notFound } from "next/navigation";
import { isValidCategorySlug } from "@/data/categoryRegistry";
import type { CategoryAdapterPageProps } from "@/components/data-entry/adapters/types";

import { FdpAttendedPage } from "@/components/data-entry/adapters/fdp-attended";
import { FdpConductedPage } from "@/components/data-entry/adapters/fdp-conducted";
import { CaseStudiesPage } from "@/components/data-entry/adapters/case-studies";
import { GuestLecturesPage } from "@/components/data-entry/adapters/guest-lectures";
import { WorkshopsPage } from "@/components/data-entry/adapters/workshops";

type AdapterComponent = React.ComponentType<CategoryAdapterPageProps>;

const ADAPTER_MAP: Record<string, AdapterComponent> = {
  "fdp-attended": FdpAttendedPage,
  "fdp-conducted": FdpConductedPage,
  "case-studies": CaseStudiesPage,
  "guest-lectures": GuestLecturesPage,
  workshops: WorkshopsPage,
};

export default function CategoryPageRouter({
  category,
  ...props
}: CategoryAdapterPageProps & { category: string }) {
  if (!isValidCategorySlug(category)) notFound();

  const Adapter = ADAPTER_MAP[category];
  if (!Adapter) notFound();

  return <Adapter {...props} />;
}
