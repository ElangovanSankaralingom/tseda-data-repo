// Canonical shared UI types used across components and hooks.

export type ToastState = {
  type: "ok" | "err";
  msg: string;
};

export type ConfirmDialogVariant = "default" | "destructive";
