"use client";

import {
  getActionButtonVariant,
  getButtonClass,
  type ButtonRole,
  type ButtonRoleSize,
} from "@/lib/ui/buttonRoles";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export type ActionButtonVariant =
  | "context"
  | "primary"
  | "destructive"
  | "ghost"
  | "link"
  | "default"
  | "danger"
  | "dark";

type ActionButtonProps = {
  children: React.ReactNode;
  variant?: ActionButtonVariant;
  role?: ButtonRole;
  size?: ButtonRoleSize;
} & Omit<React.ComponentProps<"button">, "type"> & {
    type?: "button" | "submit" | "reset";
  };

function normalizeRole(variant?: ActionButtonVariant, role?: ButtonRole): ButtonRole {
  if (role) return role;

  const normalizedVariant = getActionButtonVariant(
    variant === "dark"
      ? "primary"
      : variant === "danger"
        ? "destructive"
        : variant === "default"
          ? "context"
          : (variant ?? "context")
  );

  if (normalizedVariant === "primary") return "primary";
  if (normalizedVariant === "destructive") return "destructive";
  if (normalizedVariant === "ghost") return "ghost";
  if (normalizedVariant === "link") return "link";
  return "context";
}

export function ActionButton({
  children,
  onClick,
  variant = "context",
  disabled,
  type = "button",
  className,
  role,
  size = "default",
  ...props
}: ActionButtonProps) {
  const resolvedRole = normalizeRole(variant, role);

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      data-role={resolvedRole}
      className={cx(getButtonClass(resolvedRole, { disabled, size }), className)}
      {...props}
    >
      {children}
    </button>
  );
}
