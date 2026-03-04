import BackTo from "@/components/nav/BackTo";

export default function EntryPageHeader({
  title,
  subtitle,
  backHref,
  backDisabled = false,
  showBack = true,
  onBack,
  actions,
}: {
  title: string;
  subtitle: string;
  isViewMode: boolean;
  backHref: string;
  backDisabled?: boolean;
  showBack?: boolean;
  onBack?: (() => void | Promise<void>) | undefined;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {showBack ? (
            <BackTo href={backHref} disabled={backDisabled} compact onClick={onBack} />
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}
