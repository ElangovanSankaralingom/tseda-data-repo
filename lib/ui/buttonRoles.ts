export type ButtonRole = "primary" | "context" | "destructive" | "ghost" | "link";
export type ButtonRoleSize = "default" | "compact";

type ButtonClassOptions = {
  disabled?: boolean;
  size?: ButtonRoleSize;
};

const BASE_DEFAULT =
  "inline-flex h-10 shrink-0 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors duration-150";
const BASE_COMPACT =
  "inline-flex h-8 shrink-0 items-center justify-center rounded-full border px-3 text-sm font-medium transition-colors duration-150";

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
    return `${base} pointer-events-none cursor-not-allowed border-border bg-muted text-muted-foreground opacity-60`;
  }

  if (role === "primary") {
    return `${base} border-black bg-black text-white hover:bg-neutral-800`;
  }

  if (role === "destructive") {
    return `${base} border-red-300 bg-red-50 text-red-700 hover:bg-red-100`;
  }

  if (role === "ghost") {
    return `${base} border-border bg-transparent text-foreground hover:bg-muted`;
  }

  if (role === "link") {
    return `inline-flex items-center justify-center text-sm font-medium text-foreground underline-offset-4 hover:underline`;
  }

  return `${base} border-border bg-background text-foreground hover:bg-muted`;
}
