import Link from "next/link";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { type Pill } from "./adminLocalTypes";

type AdminPageShellProps = {
  title: string;
  subtitle: string;
  backHref: string;
  backLabel?: string;
  icon?: LucideIcon;
  pills?: Pill[];
  actions?: React.ReactNode;
  /** Extra content rendered inside the gradient header, below title row */
  headerChildren?: React.ReactNode;
  children: React.ReactNode;
  maxWidthClassName?: string;
};

export default function AdminPageShell({
  title,
  subtitle,
  backHref,
  backLabel = "Admin Console",
  icon: Icon,
  pills,
  actions,
  headerChildren,
  children,
  maxWidthClassName = "max-w-7xl",
}: AdminPageShellProps) {
  return (
    <div className={`mx-auto w-full ${maxWidthClassName} px-4 py-8`}>
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={backHref}
              className="group mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-slate-300 transition-all duration-200 hover:bg-white/20 hover:text-white active:scale-95"
            >
              <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
              {backLabel}
            </Link>
            <div className="flex items-center gap-3">
              {Icon && (
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <Icon className="size-5 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-white">{title}</h1>
                <p className="mt-0.5 text-sm text-slate-300">{subtitle}</p>
              </div>
            </div>
            {pills && pills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {pills.map((pill) => (
                  <span
                    key={pill.label}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${pill.color ?? "bg-white/10 text-slate-300"}`}
                  >
                    {pill.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {headerChildren}
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}
