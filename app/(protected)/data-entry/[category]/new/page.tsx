import { redirect } from "next/navigation";
import CategoryPageRouter from "@/components/data-entry/CategoryPageRouter";
import { sessionMayViewCategory } from "@/lib/entries/entryScopeGate";
import { dashboard } from "@/lib/entryNavigation";

export const dynamic = "force-dynamic";

type CategoryNewPageProps = {
  params: Promise<{ category: string }>;
};

export default async function CategoryNewPage({ params }: CategoryNewPageProps) {
  const { category } = await params;
  // Entry-scope gate (B2): dlc categories are visible only to their DLC.
  if (!(await sessionMayViewCategory(category))) redirect(dashboard());
  return <CategoryPageRouter category={category} startInNewMode />;
}
