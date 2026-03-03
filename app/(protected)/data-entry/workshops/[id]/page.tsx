import { WorkshopsPage } from "../page";

type WorkshopsViewPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function WorkshopsViewPage({ params }: WorkshopsViewPageProps) {
  const { id } = await params;

  return <WorkshopsPage viewEntryId={id} />;
}
