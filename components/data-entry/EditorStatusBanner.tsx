"use client";

import { useCallback, useState } from "react";
import { AlertTriangle, Archive, Clock, Lock, Shield, Unlock } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
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
    bg: "bg-[var(--color-status-success-bg)]",
    border: "border-[var(--color-status-success-border)]",
    text: "text-[var(--color-status-success)]",
    iconColor: "text-[var(--color-status-success)]",
  },
  editable: {
    icon: Clock,
    bg: "bg-[var(--color-status-info-bg)]",
    border: "border-[var(--color-status-info-border)]",
    text: "text-[var(--color-status-info)]",
    iconColor: "text-[var(--color-status-info)]",
  },
  edit_requested: {
    icon: Clock,
    bg: "bg-[var(--color-status-warning-bg)]",
    border: "border-[var(--color-status-warning-border)]",
    text: "text-[var(--color-status-warning)]",
    iconColor: "text-[var(--color-status-warning)]",
  },
  edit_granted: {
    icon: Unlock,
    bg: "bg-[var(--color-palette-purple-bg)]",
    border: "border-[var(--color-palette-purple-border)]",
    text: "text-[var(--color-palette-purple-fg)]",
    iconColor: "text-[var(--color-palette-purple-fg)]",
  },
  delete_requested: {
    icon: AlertTriangle,
    bg: "bg-[var(--color-status-error-bg)]",
    border: "border-[var(--color-status-error-border)]",
    text: "text-[var(--color-status-error)]",
    iconColor: "text-[var(--color-status-error)]",
  },
  archived: {
    icon: Archive,
    bg: "bg-[var(--color-body-bg)]",
    border: "border-[var(--color-glass-border)]",
    text: "text-[var(--color-text-primary)]",
    iconColor: "text-[var(--color-text-secondary)]",
  },
  expiring_soon: {
    icon: AlertTriangle,
    bg: "bg-[var(--color-status-error-bg)]",
    border: "border-[var(--color-status-error-border)]",
    text: "text-[var(--color-status-error)]",
    iconColor: "text-[var(--color-status-error)]",
  },
  permanently_locked: {
    icon: Shield,
    bg: "bg-[var(--color-body-bg)]",
    border: "border-[var(--color-glass-border)]",
    text: "text-[var(--color-text-secondary)]",
    iconColor: "text-[var(--color-text-secondary)]",
  },
};

function StatusStrip({
  variant,
  message,
  actionLabel,
  onAction,
  actionDisabled,
}: {
  variant: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
}) {
  const style = STRIP_STYLES[variant] ?? STRIP_STYLES.finalized;
  const Icon = style.icon;

  return (
    <div
      className={`${style.bg} border ${style.border} rounded-lg px-4 py-2 flex items-center gap-2.5 animate-fade-in`}
    >
      <Icon className={`size-4 shrink-0 ${style.iconColor}`} />
      <span className={`flex-1 text-sm ${style.text}`}>{message}</span>
      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          disabled={!onAction || actionDisabled}
          className={`shrink-0 text-sm font-medium ${style.text} opacity-80 hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed`}
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
  const { t } = useTranslation();
  const [cancelling, setCancelling] = useState(false);

  const handleCancelEdit = useCallback(async () => {
    if (cancelling || !onCancelRequest) return;
    setCancelling(true);
    try {
      await onCancelRequest();
    } finally {
      setCancelling(false);
    }
  }, [cancelling, onCancelRequest]);

  const handleCancelDelete = useCallback(async () => {
    if (cancelling) return;
    const fn = onCancelRequestDelete ?? onCancelRequest;
    if (!fn) return;
    setCancelling(true);
    try {
      await fn();
    } finally {
      setCancelling(false);
    }
  }, [cancelling, onCancelRequest, onCancelRequestDelete]);

  // Expiring soon — urgent
  const isExpiringSoon = editTimeMs !== undefined && editTimeMs > 0 && editTimeMs < 24 * 60 * 60 * 1000;
  if (isExpiringSoon && editTimeLabel) {
    return (
      <StatusStrip
        variant="expiring_soon"
        message={`${t('entry.editWindowClosesIn')} ${editTimeLabel} \u2014 ${t('entry.saveYourChanges')}`}
      />
    );
  }

  if (status === "EDIT_GRANTED") {
    return (
      <StatusStrip
        variant="edit_granted"
        message={editTimeLabel ? `${t('entry.editAccessGranted')} \u00B7 ${t('entry.expiresIn')} ${editTimeLabel}` : t('entry.editAccessGranted')}
      />
    );
  }

  if (status === "EDIT_REQUESTED") {
    return (
      <StatusStrip
        variant="edit_requested"
        message={t('entry.editRequestPending')}
        actionLabel={cancelling ? t('entry.cancellingRequest') : t('entry.cancelRequest')}
        onAction={handleCancelEdit}
        actionDisabled={cancelling}
      />
    );
  }

  if (status === "DELETE_REQUESTED") {
    return (
      <StatusStrip
        variant="delete_requested"
        message={t('entry.deleteRequestPending')}
        actionLabel={cancelling ? t('entry.cancellingRequest') : t('entry.cancelRequest')}
        onAction={handleCancelDelete}
        actionDisabled={cancelling}
      />
    );
  }

  if (status === "ARCHIVED") {
    return (
      <StatusStrip
        variant="archived"
        message={t('entry.entryArchived')}
      />
    );
  }

  if (!isEditable && status === "GENERATED") {
    if (permanentlyLocked) {
      return (
        <StatusStrip
          variant="permanently_locked"
          message={t('entry.entryFinalised')}
        />
      );
    }
    return (
      <StatusStrip
        variant="finalized"
        message={`${t('entry.entryFinalisedReadOnly')}${hasPdf ? ` \u00B7 ${t('entry.documentAvailableBelow')}` : ""}`}
      />
    );
  }

  // Editable GENERATED entry with edit window — show countdown
  if (isEditable && status === "GENERATED" && editTimeLabel) {
    return (
      <StatusStrip
        variant="editable"
        message={`${t('entry.entryGenerated')} \u00B7 ${t('entry.editWindowClosesIn')} ${editTimeLabel.replace(/ left$/, "")}`}
      />
    );
  }

  return null;
}
