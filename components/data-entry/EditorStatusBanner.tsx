"use client";

import { AlertTriangle, Archive, Clock, Lock, Shield, Unlock } from "lucide-react";
import { type EditorStatusBannersProps } from "./dataEntryTypes";

/**
 * EntryStatusStrip — compact single-line status indicator.
 * Replaces the previous multi-line EditorStatusBanners.
 * Height: ~40px, full width, rounded-lg.
 */

type StripConfig = {
  icon: React.ElementType;
  bg: string;
  border: string;
  text: string;
  iconColor: string;
};

const STRIP_STYLES: Record<string, StripConfig> = {
  finalized: {
    icon: Lock,
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    iconColor: "text-emerald-500",
  },
  editable: {
    icon: Clock,
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    iconColor: "text-blue-500",
  },
  edit_requested: {
    icon: Clock,
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    iconColor: "text-amber-500",
  },
  edit_granted: {
    icon: Unlock,
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
    iconColor: "text-purple-500",
  },
  delete_requested: {
    icon: AlertTriangle,
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    iconColor: "text-red-500",
  },
  archived: {
    icon: Archive,
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-500",
    iconColor: "text-slate-400",
  },
  expiring_soon: {
    icon: AlertTriangle,
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    iconColor: "text-red-500",
  },
  permanently_locked: {
    icon: Shield,
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-600",
    iconColor: "text-slate-400",
  },
};

function StatusStrip({
  variant,
  message,
  actionLabel,
  onAction,
}: {
  variant: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const style = STRIP_STYLES[variant] ?? STRIP_STYLES.finalized;
  const Icon = style.icon;

  return (
    <div
      className={`${style.bg} border ${style.border} rounded-lg px-4 py-2 flex items-center gap-2.5 animate-fade-in`}
    >
      <Icon className={`size-4 shrink-0 ${style.iconColor}`} />
      <span className={`flex-1 text-sm ${style.text}`}>{message}</span>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className={`shrink-0 text-sm font-medium ${style.text} opacity-80 hover:opacity-100 transition-opacity`}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

// Keep the old default export name for backwards compat with imports
export default function EditorStatusBanner({
  variant,
  message,
  actionLabel,
  onAction,
}: {
  variant: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <StatusStrip
      variant={variant}
      message={message}
      actionLabel={actionLabel}
      onAction={onAction}
    />
  );
}

export function EditorStatusBanners({
  status,
  isEditable,
  editTimeLabel,
  editTimeMs,
  hasPdf,
  permanentlyLocked = false,
  onCancelRequest,
  onCancelRequestDelete,
}: EditorStatusBannersProps) {
  // Expiring soon — urgent
  const isExpiringSoon = editTimeMs !== undefined && editTimeMs > 0 && editTimeMs < 24 * 60 * 60 * 1000;
  if (isExpiringSoon && editTimeLabel) {
    return (
      <StatusStrip
        variant="expiring_soon"
        message={`Edit window closes in ${editTimeLabel} — save your changes`}
      />
    );
  }

  if (status === "EDIT_GRANTED") {
    return (
      <StatusStrip
        variant="edit_granted"
        message={editTimeLabel ? `Edit access granted · Expires in ${editTimeLabel}` : "Edit access granted"}
      />
    );
  }

  if (status === "EDIT_REQUESTED") {
    return (
      <StatusStrip
        variant="edit_requested"
        message="Edit request pending · Waiting for admin approval"
        actionLabel="Cancel Request"
        onAction={onCancelRequest}
      />
    );
  }

  if (status === "DELETE_REQUESTED") {
    return (
      <StatusStrip
        variant="delete_requested"
        message="Delete request pending · Waiting for admin approval"
        actionLabel="Cancel Request"
        onAction={onCancelRequestDelete ?? onCancelRequest}
      />
    );
  }

  if (status === "ARCHIVED") {
    return (
      <StatusStrip
        variant="archived"
        message="This entry has been archived"
      />
    );
  }

  if (!isEditable && status === "GENERATED") {
    if (permanentlyLocked) {
      return (
        <StatusStrip
          variant="permanently_locked"
          message="Entry finalised · Permanently locked"
        />
      );
    }
    return (
      <StatusStrip
        variant="finalized"
        message={`Entry finalised · Read-only${hasPdf ? " · Document available below" : ""}`}
      />
    );
  }

  // Editable GENERATED entry with edit window — show countdown
  if (isEditable && status === "GENERATED" && editTimeLabel) {
    return (
      <StatusStrip
        variant="editable"
        message={`Entry generated · Edit window closes in ${editTimeLabel.replace(/ left$/, "")}`}
      />
    );
  }

  return null;
}
