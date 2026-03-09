import type { ConfirmationDialogOptions } from "@/lib/confirmations/types";
import type { AdminNotification } from "@/lib/confirmations/types";

export type PendingConfirm = {
  options: ConfirmationDialogOptions;
  resolve: (value: boolean) => void;
};

export type AdminNotificationWithRead = AdminNotification & { read: boolean };
