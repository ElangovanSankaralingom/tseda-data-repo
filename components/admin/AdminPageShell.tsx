import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type AdminPageShellProps = {
  title: string;
  subtitle: string;
  backHref: string;
  backLabel?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  maxWidthClassName?: string;
};

export default function AdminPageShell({
  title,
  subtitle,
  backHref,
  backLabel = "Admin",
  actions,
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
              className="group mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-slate-300 transition-all duration-200 hover:bg-white/20 hover:text-white active:scale-95"
            >
              <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
              {backLabel}
            </Link>
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            <p className="mt-1 text-sm text-slate-300">{subtitle}</p>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}
