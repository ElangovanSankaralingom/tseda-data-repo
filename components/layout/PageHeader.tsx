import BackTo from "@/components/nav/BackTo";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  backHref?: string;
  backDisabled?: boolean;
  showBack?: boolean;
  onBack?: (() => void | Promise<void>) | undefined;
  actions?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
};

export default function PageHeader({
  title,
  subtitle,
  backHref = "/dashboard",
  backDisabled = false,
  showBack = false,
  onBack,
  actions,
  className,
  titleClassName,
  subtitleClassName,
}: PageHeaderProps) {
  return (
    <div className={cx("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {showBack ? <BackTo href={backHref} disabled={backDisabled} compact onClick={onBack} /> : null}
          <h1 className={cx("text-2xl font-semibold tracking-tight", titleClassName)}>{title}</h1>
        </div>
        {subtitle ? (
          <p className={cx("mt-1 text-sm text-muted-foreground", subtitleClassName)}>{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
