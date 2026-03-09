// Canonical shared UI types used across components and hooks.

export type ToastState = {
  type: "ok" | "err";
  msg: string;
};

export type ConfirmDialogVariant = "default" | "destructive";

export type BannerVariant = "finalized" | "edit_requested" | "edit_granted" | "expiring_soon";

export type EntryShellMode = "new" | "edit" | "view" | "preview";

export type GenerateButtonState = "idle" | "generating" | "success";

export type MetricCardTone = "neutral" | "warning" | "success" | "danger";

export type FilterKey = "all" | "active" | "drafts" | "finalized" | "pending";

export type ActionButtonVariant =
  | "context"
  | "primary"
  | "destructive"
  | "ghost"
  | "link"
  | "default"
  | "danger"
  | "dark";

export type FilterTab = {
  key: string;
  label: string;
  count?: number;
};

export type SelectDropdownOption = {
  label: string;
  value: string;
  disabled?: boolean;
};
