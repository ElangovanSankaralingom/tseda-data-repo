import { FdpAttendedPage } from "../page";

type FdpAttendedViewPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function FdpAttendedViewPage({ params }: FdpAttendedViewPageProps) {
  const { id } = await params;

  return <FdpAttendedPage viewEntryId={id} />;
}
