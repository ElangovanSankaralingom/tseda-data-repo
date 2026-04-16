import type { LucideIcon } from "lucide-react";

export default function SectionHeader({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      {Icon && (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10">
          <Icon className="size-4 text-[var(--color-primary)]" />
        </div>
      )}
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight text-[var(--color-text-primary)]">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            {description}
          </p>
        )}
      </div>
      <div className="ml-3 h-px flex-1 bg-gradient-to-r from-[var(--color-glass-border)] to-transparent" />
    </div>
  );
}
