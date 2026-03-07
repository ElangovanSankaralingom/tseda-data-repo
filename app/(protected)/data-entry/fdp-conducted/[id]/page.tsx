import { FdpConductedPage } from "../page";

export const dynamic = "force-dynamic";

type FdpConductedViewPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function FdpConductedViewPage({ params }: FdpConductedViewPageProps) {
  const { id } = await params;

  return <FdpConductedPage editEntryId={id} />;
}
