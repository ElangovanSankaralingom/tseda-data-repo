import CategoryPageRouter from "@/components/data-entry/CategoryPageRouter";

export const dynamic = "force-dynamic";

type CategoryNewPageProps = {
  params: Promise<{ category: string }>;
};

export default async function CategoryNewPage({ params }: CategoryNewPageProps) {
  const { category } = await params;
  return <CategoryPageRouter category={category} startInNewMode />;
}
