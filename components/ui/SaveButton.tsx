"use client";

import { ActionButton } from "@/components/ui/ActionButton";

type SaveButtonProps = React.ComponentProps<typeof ActionButton>;

export function SaveButton(props: SaveButtonProps) {
  return <ActionButton variant="ghost" {...props} />;
}
