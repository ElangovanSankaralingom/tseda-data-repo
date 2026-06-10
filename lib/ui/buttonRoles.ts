export type ButtonRole = "primary" | "context" | "destructive" | "ghost" | "link";
export type ButtonRoleSize = "default" | "compact";

type ButtonClassOptions = {
  disabled?: boolean;
  size?: ButtonRoleSize;
};

const BASE_DEFAULT =
  "inline-flex h-10 shrink-0 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-all duration-150 active:scale-[0.97]";
const BASE_COMPACT =
  "inline-flex h-8 shrink-0 items-center justify-center rounded-full border px-3 text-sm font-medium transition-all duration-150 active:scale-[0.97]";

export function getButtonVariant(role: ButtonRole) {
  if (role === "primary") return "default" as const;
  if (role === "destructive") return "destructive" as const;
  if (role === "ghost") return "ghost" as const;
  if (role === "link") return "link" as const;
  return "outline" as const;
}

export function getActionButtonVariant(role: ButtonRole) {
  if (role === "primary") return "primary" as const;
  if (role === "destructive") return "destructive" as const;
  if (role === "ghost") return "ghost" as const;
  if (role === "link") return "link" as const;
  return "context" as const;
}

export function getButtonClass(role: ButtonRole, options: ButtonClassOptions = {}) {
  const { disabled = false, size = "default" } = options;
  const base = size === "compact" ? BASE_COMPACT : BASE_DEFAULT;

  if (disabled) {
    return `${base} pointer-events-none cursor-not-allowed border-[var(--color-card-border)] bg-[var(--color-card-bg)] text-[var(--color-text-muted)] opacity-60`;
  }

  if (role === "primary") {
    return `${base} border-[var(--color-button-primary-bg)] bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-text)] shadow-sm hover:bg-[var(--color-button-primary-hover)] hover:shadow`;
  }

  if (role === "destructive") {
    return `${base} border-red-500 bg-red-500 text-[var(--color-text-on-accent)] hover:bg-red-600`;
  }

  if (role === "ghost") {
    return `${base} border-transparent bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-dropdown-hover)]`;
  }

  if (role === "link") {
    return `inline-flex items-center justify-center text-sm font-medium text-[var(--color-text-secondary)] underline-offset-4 hover:underline`;
  }

  return `${base} border-[var(--color-card-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-dropdown-hover)]`;
}
