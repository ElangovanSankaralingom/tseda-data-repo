import { FdpAttendedPage } from "../page";

export const dynamic = "force-dynamic";

type FdpAttendedViewPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function FdpAttendedViewPage({ params }: FdpAttendedViewPageProps) {
  const { id } = await params;

  return <FdpAttendedPage editEntryId={id} />;
}
