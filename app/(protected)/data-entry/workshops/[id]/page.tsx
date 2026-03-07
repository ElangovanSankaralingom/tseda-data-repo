import { WorkshopsPage } from "../page";

export const dynamic = "force-dynamic";

type WorkshopsViewPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function WorkshopsViewPage({ params }: WorkshopsViewPageProps) {
  const { id } = await params;

  return <WorkshopsPage editEntryId={id} />;
}
