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
    return `${base} pointer-events-none cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-60`;
  }

  if (role === "primary") {
    return `${base} border-[#1E3A5F] bg-[#1E3A5F] text-white shadow-sm hover:bg-[#2D5F8A] hover:shadow`;
  }

  if (role === "destructive") {
    return `${base} border-red-500 bg-red-500 text-white hover:bg-red-600`;
  }

  if (role === "ghost") {
    return `${base} border-transparent bg-transparent text-slate-700 hover:bg-slate-100`;
  }

  if (role === "link") {
    return `inline-flex items-center justify-center text-sm font-medium text-slate-700 underline-offset-4 hover:underline`;
  }

  return `${base} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
}
