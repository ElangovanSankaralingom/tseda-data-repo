import { CaseStudiesPage } from "../page";

type CaseStudiesViewPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CaseStudiesViewPage({ params }: CaseStudiesViewPageProps) {
  const { id } = await params;

  return <CaseStudiesPage editEntryId={id} />;
}
