// ---------------------------------------------------------------------------
// Confirmation & Notification System — Type Definitions
// ---------------------------------------------------------------------------

export type ConfirmationType = "info" | "warning" | "danger" | "success";
export type ToastType = "success" | "error" | "warning" | "info" | "loading" | "undo";

// --- Confirmation Dialog ---

export type ConfirmationDialogOptions = {
  type: ConfirmationType;
  title: string;
  message: string;
  details?: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmStyle: "primary" | "danger" | "warning";
  requireTypedConfirmation?: string;
  countdown?: number;
  preventOutsideClose?: boolean;
};

// --- Toast Notification ---

export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type ToastOptions = {
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  dismissible?: boolean;
  action?: ToastAction;
  progress?: boolean;
};

export type Toast = ToastOptions & {
  id: string;
  createdAt: number;
};

// --- Undo Action ---

export type UndoOptions = {
  description: string;
  undoFn: () => Promise<void>;
  timeout?: number;
  onExpire?: () => void;
};

// --- Progress Notification ---

export type ProgressStatus = "running" | "success" | "error";

export type ProgressNotification = {
  id: string;
  title: string;
  status: ProgressStatus;
  progress?: number;
  message?: string;
  startedAt: number;
  completedAt?: number;
  result?: { summary: string; details?: string };
};

// --- Persistent Notification ---

export type PersistentNotificationType =
  | "edit_request_granted"
  | "edit_request_rejected"
  | "delete_approved"
  | "delete_rejected"
  | "auto_archived"
  | "timer_warning"
  | "entry_finalized"
  | "streak_won"
  | "system_announcement";

export type PersistentNotification = {
  id: string;
  type: PersistentNotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
};

export type NotificationStore = {
  notifications: PersistentNotification[];
};

// --- Admin Notification ---

export type AdminNotificationType =
  | "edit_request"
  | "delete_request"
  | "pending_requests_reminder"
  | "backup_overdue"
  | "integrity_issues"
  | "wal_warning"
  | "new_user"
  | "user_status_change"
  | "settings_changed"
  | "migration_complete"
  | "system_error";

export type AdminNotification = {
  id: string;
  type: AdminNotificationType;
  title: string;
  message: string;
  createdAt: string;
  readBy: string[];
  actionUrl?: string;
  actionLabel?: string;
  triggeredBy?: string;
  triggeredByName?: string;
};

export type AdminNotificationStore = {
  notifications: AdminNotification[];
};

// --- Context API ---

export type ConfirmFn = (options: ConfirmationDialogOptions) => Promise<boolean>;

export type ToastFn = (options: ToastOptions) => string;

export type ConfirmationContextValue = {
  confirm: ConfirmFn;

  toast: ToastFn;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
  loading: (title: string, message?: string) => string;
  updateToast: (id: string, updates: Partial<ToastOptions>) => void;
  dismissToast: (id: string) => void;

  undoable: (
    description: string,
    action: () => Promise<void>,
    undoFn: () => Promise<void>,
    timeout?: number,
  ) => void;

  startProgress: (title: string) => string;
  updateProgress: (id: string, progress: number, message?: string) => void;
  completeProgress: (id: string, summary: string) => void;
  failProgress: (id: string, error: string) => void;
};
