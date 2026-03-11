export type FileMetaLike = {
  fileName: string;
  size: number;
  uploadedAt: string;
  url: string;
} | null;

export type FinaliseState = {
  canFinalise: boolean;
  onFinalise: () => void | Promise<boolean>;
  onAfterFinalise?: () => void;
  disabledReason?: string;
  editWindowExpiresAt?: string | null;
};

// --- Props from EntryActionsBar.tsx ---

export type HeaderEntryActionsBarProps = {
  isEditing: boolean;
  isViewMode: boolean;
  loading: boolean;
  formHasData?: boolean;
  onAdd?: () => void;
  addLabel?: string;
  onCancel: () => void;
  cancelDisabled: boolean;
  onSave: () => void;
  saveDisabled: boolean;
  onDone: () => void;
  doneDisabled: boolean;
  saving: boolean;
  saveIntent: "save" | "done" | null;
  workflowAction?: {
    label: string;
    onClick: () => void | Promise<boolean>;
    disabled?: boolean;
    busyLabel?: string;
  };
  workflowDisabledHint?: string;
  finalise?: FinaliseState;
  entryStatus?: string | null;
  editRequestPending?: boolean;
  deleteRequestPending?: boolean;
  onRequestEdit?: () => void;
  onCancelRequestEdit?: () => void;
  onRequestDelete?: () => void;
  onCancelRequestDelete?: () => void;
  editTimeLabel?: string;
  onBack?: () => void;
  permanentlyLocked?: boolean;
  requestActionUsed?: boolean;
};

export type PdfEntryActionsBarProps = {
  isViewMode: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
  generating: boolean;
  pdfMeta: { url?: string | null; fileName?: string } | null | undefined;
  pdfDisabled: boolean;
};
