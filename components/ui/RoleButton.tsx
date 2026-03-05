"use client";

import { ActionButton } from "@/components/ui/ActionButton";
import type { ButtonRole, ButtonRoleSize } from "@/lib/ui/buttonRoles";

type RoleButtonProps = Omit<React.ComponentProps<typeof ActionButton>, "role" | "variant" | "size"> & {
  role?: ButtonRole;
  size?: ButtonRoleSize;
};

export function RoleButton({ role = "context", size = "default", ...props }: RoleButtonProps) {
  return <ActionButton role={role} size={size} {...props} />;
}
