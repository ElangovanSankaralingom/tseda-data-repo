"use client";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type ActionButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "ghost" | "danger" | "dark";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
};

export function ActionButton({
  children,
  onClick,
  variant = "default",
  disabled,
  type = "button",
  className,
}: ActionButtonProps) {
  const base = "inline-flex h-10 shrink-0 items-center justify-center rounded-lg border px-3 text-sm";
  const activeCls =
    variant === "danger"
      ? "border-border text-red-600 transition hover:bg-red-50"
      : variant === "ghost"
        ? "border-border transition hover:bg-muted"
        : variant === "dark"
          ? "border-black bg-black text-white transition-colors hover:bg-neutral-800"
          : "border-foreground bg-foreground text-background transition hover:opacity-90";
  const disabledCls =
    variant === "dark"
      ? "pointer-events-none cursor-not-allowed border-neutral-300 bg-neutral-300 text-neutral-500 opacity-100"
      : variant === "default"
        ? "pointer-events-none cursor-not-allowed border-border bg-muted text-muted-foreground opacity-60"
        : "pointer-events-none cursor-not-allowed border-border bg-transparent text-muted-foreground opacity-60";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(base, disabled ? disabledCls : activeCls, className)}
    >
      {children}
    </button>
  );
}
