import CategoryPageRouter from "@/components/data-entry/CategoryPageRouter";

export const dynamic = "force-dynamic";

type CategoryListPageProps = {
  params: Promise<{ category: string }>;
};

export default async function CategoryListPage({ params }: CategoryListPageProps) {
  const { category } = await params;
  return <CategoryPageRouter category={category} />;
}
