"use client";

import { ActionButton } from "@/components/ui/ActionButton";

export function SaveButton(props: React.ComponentProps<typeof ActionButton>) {
  return <ActionButton role="primary" {...props} />;
}
