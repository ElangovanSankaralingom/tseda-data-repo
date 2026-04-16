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
    <section className={cx("rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-sm p-4 shadow-sm sm:p-5", className)}>
      {title || subtitle || actions ? (
        <div className={cx("mb-4 flex flex-wrap items-start justify-between gap-3", headerClassName)}>
          <div className="min-w-0">
            {title ? <h2 className="text-base font-semibold tracking-tight text-[var(--color-text-primary)]">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-[var(--color-text-muted)]">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={contentClassName}>{children}</div>
    </section>
  );
}
