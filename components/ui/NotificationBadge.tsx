function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function NotificationBadge({
  count,
  className,
}: { count: number; className?: string }) {
  if (count <= 0) return null;

  return (
    <div
      className={cx(
        "absolute z-20 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-foreground px-2 text-xs font-semibold text-background shadow-sm",
        className
      )}
    >
      {count}
    </div>
  );
}
