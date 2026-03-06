function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type SectionCardProps = {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
};

export default function SectionCard({
  title,
  subtitle,
  actions,
  children,
  className,
  headerClassName,
  contentClassName,
}: SectionCardProps) {
  return (
    <section className={cx("rounded-2xl border border-border bg-card p-4 sm:p-5", className)}>
      {title || subtitle || actions ? (
        <div className={cx("mb-4 flex flex-wrap items-start justify-between gap-3", headerClassName)}>
          <div className="min-w-0">
            {title ? <h2 className="text-base font-semibold tracking-tight">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={contentClassName}>{children}</div>
    </section>
  );
}
