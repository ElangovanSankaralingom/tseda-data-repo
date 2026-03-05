import { GuestLecturesPage } from "../page";

type GuestLecturesViewPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function GuestLecturesViewPage({ params }: GuestLecturesViewPageProps) {
  const { id } = await params;

  return <GuestLecturesPage editEntryId={id} />;
}
