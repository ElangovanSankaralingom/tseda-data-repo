import PageHeader from "@/components/layout/PageHeader";

type AdminPageShellProps = {
  title: string;
  subtitle: string;
  backHref: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  maxWidthClassName?: string;
};

export default function AdminPageShell({
  title,
  subtitle,
  backHref,
  actions,
  children,
  maxWidthClassName = "max-w-7xl",
}: AdminPageShellProps) {
  return (
    <div className={`mx-auto w-full ${maxWidthClassName} px-4 py-8`}>
      <PageHeader title={title} subtitle={subtitle} backHref={backHref} showBack actions={actions} />
      <div className="mt-6 space-y-5">{children}</div>
    </div>
  );
}
