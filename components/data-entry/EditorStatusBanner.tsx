"use client";

import { AlertTriangle, Clock, Lock, Unlock } from "lucide-react";

type BannerVariant = "finalized" | "edit_requested" | "edit_granted" | "expiring_soon";

const BANNER_STYLES: Record<BannerVariant, { bg: string; border: string; iconColor: string }> = {
  finalized: { bg: "bg-slate-50", border: "border-slate-200", iconColor: "text-slate-500" },
  edit_requested: { bg: "bg-amber-50", border: "border-amber-200", iconColor: "text-amber-500" },
  edit_granted: { bg: "bg-purple-50", border: "border-purple-200", iconColor: "text-purple-500" },
  expiring_soon: { bg: "bg-red-50", border: "border-red-200", iconColor: "text-red-500" },
};

const BANNER_ICONS: Record<BannerVariant, React.ElementType> = {
  finalized: Lock,
  edit_requested: Clock,
  edit_granted: Unlock,
  expiring_soon: AlertTriangle,
};

type EditorStatusBannerProps = {
  variant: BannerVariant;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function EditorStatusBanner({
  variant,
  message,
  actionLabel,
  onAction,
}: EditorStatusBannerProps) {
  const style = BANNER_STYLES[variant];
  const Icon = BANNER_ICONS[variant];
  const isUrgent = variant === "expiring_soon";

  return (
    <div
      className={`${style.bg} border ${style.border} rounded-xl p-4 flex items-center gap-3 animate-fade-in-up`}
    >
      <Icon
        className={`size-5 shrink-0 ${style.iconColor} ${
          isUrgent ? "animate-subtle-pulse" : variant === "edit_requested" ? "animate-subtle-pulse" : ""
        }`}
      />
      <span className="flex-1 text-sm text-slate-700">{message}</span>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

type EditorStatusBannersProps = {
  status?: string | null;
  isEditable: boolean;
  editTimeLabel?: string;
  editTimeMs?: number;
  onRequestEdit?: () => void;
  onCancelRequest?: () => void;
};

export function EditorStatusBanners({
  status,
  isEditable,
  editTimeLabel,
  editTimeMs,
  onRequestEdit,
  onCancelRequest,
}: EditorStatusBannersProps) {
  const isExpiringSoon = editTimeMs !== undefined && editTimeMs > 0 && editTimeMs < 24 * 60 * 60 * 1000;

  // Expiring soon takes priority
  if (isExpiringSoon && editTimeLabel) {
    return (
      <EditorStatusBanner
        variant="expiring_soon"
        message={`Edit window closes in ${editTimeLabel} — save your changes!`}
      />
    );
  }

  if (status === "EDIT_GRANTED") {
    return (
      <EditorStatusBanner
        variant="edit_granted"
        message={`Edit access granted${editTimeLabel ? ` — expires in ${editTimeLabel}` : ""}`}
      />
    );
  }

  if (status === "EDIT_REQUESTED") {
    return (
      <EditorStatusBanner
        variant="edit_requested"
        message="Edit request pending — waiting for admin approval"
        actionLabel="Cancel Request"
        onAction={onCancelRequest}
      />
    );
  }

  if (!isEditable && status === "GENERATED") {
    return (
      <EditorStatusBanner
        variant="finalized"
        message="This entry has been finalized. All fields are read-only."
        actionLabel="Request Edit"
        onAction={onRequestEdit}
      />
    );
  }

  return null;
}
