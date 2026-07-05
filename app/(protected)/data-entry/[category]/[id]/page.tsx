import { redirect } from "next/navigation";
import CategoryPageRouter from "@/components/data-entry/CategoryPageRouter";
import { sessionMayViewCategory } from "@/lib/entries/entryScopeGate";
import { dashboard } from "@/lib/entryNavigation";

export const dynamic = "force-dynamic";

type CategoryEntryPageProps = {
  params: Promise<{ category: string; id: string }>;
};

export default async function CategoryEntryPage({ params }: CategoryEntryPageProps) {
  const { category, id } = await params;
  // Entry-scope gate (B2): dlc categories are visible only to their DLC.
  if (!(await sessionMayViewCategory(category))) redirect(dashboard());
  return <CategoryPageRouter category={category} editEntryId={id} />;
}
