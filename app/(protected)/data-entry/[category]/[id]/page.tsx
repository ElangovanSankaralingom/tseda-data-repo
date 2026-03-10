import CategoryPageRouter from "@/components/data-entry/CategoryPageRouter";

export const dynamic = "force-dynamic";

type CategoryEntryPageProps = {
  params: Promise<{ category: string; id: string }>;
};

export default async function CategoryEntryPage({ params }: CategoryEntryPageProps) {
  const { category, id } = await params;
  return <CategoryPageRouter category={category} editEntryId={id} />;
}
