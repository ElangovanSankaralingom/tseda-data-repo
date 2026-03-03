import Link from "next/link";

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M15 6 9 12l6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function EntryPageHeader({
  title,
  subtitle,
  isViewMode,
  backHref,
  backDisabled = false,
  actions,
}: {
  title: string;
  subtitle: string;
  isViewMode: boolean;
  backHref: string;
  backDisabled?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        {isViewMode ? (
          backDisabled ? (
            <button
              type="button"
              disabled
              className="pointer-events-none inline-flex items-center gap-1.5 text-sm text-muted-foreground opacity-60"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              <span>Back</span>
            </button>
          ) : (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              <span>Back</span>
            </Link>
          )
        ) : null}

        <div className={isViewMode ? "mt-2" : "flex items-center gap-2"}>
          {!isViewMode ? (
            backDisabled ? (
              <button
                type="button"
                disabled
                aria-label="Back"
                className="pointer-events-none inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground opacity-60"
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </button>
            ) : (
              <Link
                href={backHref}
                aria-label="Back"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </Link>
            )
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}
