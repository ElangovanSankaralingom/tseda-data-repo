import { FdpConductedPage } from "../page";

type FdpConductedViewPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function FdpConductedViewPage({ params }: FdpConductedViewPageProps) {
  const { id } = await params;

  return <FdpConductedPage viewEntryId={id} />;
}
