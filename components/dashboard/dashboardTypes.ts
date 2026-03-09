import type { LucideIcon } from "lucide-react";

export type CategoryAccent = {
  icon: LucideIcon;
  bg: string;
  iconColor: string;
  ring: string;
  cta: string;
};

export type StatusPill = {
  label: string;
  count: number;
  className: string;
};
