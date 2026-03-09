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
  expiresAtISO?: string | null;
  hasPdf?: boolean;
  permanentlyLocked?: boolean;
  onCancelRequest?: () => void;
};

function formatFinalizedAgo(expiresAtISO: string): string {
  const expiry = new Date(expiresAtISO);
  if (Number.isNaN(expiry.getTime())) return "";
  const diff = Date.now() - expiry.getTime();
  if (diff < 0) return "";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} ${days === 1 ? "day" : "days"} ago`;
  if (hours > 0) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  return "just now";
}

function getEditTimeUrgencyClass(remainingMs: number): string {
  if (remainingMs < 24 * 60 * 60 * 1000) return "text-red-600 font-semibold";
  if (remainingMs < 3 * 24 * 60 * 60 * 1000) return "text-amber-600";
  return "text-slate-500";
}

export function EditorStatusBanners({
  status,
  isEditable,
  editTimeLabel,
  editTimeMs,
  expiresAtISO,
  hasPdf,
  permanentlyLocked = false,
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
        message={editTimeLabel ? `🔓 Edit access expires in ${editTimeLabel}` : "🔓 Edit access granted"}
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
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-5 animate-fade-in-up">
        <div className="flex items-start gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
            <Lock className="size-5 text-emerald-600" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-emerald-900">Entry Finalised</h3>
            <p className="text-sm text-emerald-700">
              This entry is now locked and read-only.{hasPdf ? " You can still preview and download the generated document below." : ""}
            </p>
            <p className="mt-2 text-xs text-emerald-600/70">
              {permanentlyLocked
                ? "This entry is permanently locked and cannot be modified."
                : "Need to make changes? Use Request Action above to request edit or delete access from your admin."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Editable GENERATED entry with edit window — show countdown
  if (isEditable && status === "GENERATED" && editTimeLabel && editTimeMs !== undefined) {
    const urgencyClass = getEditTimeUrgencyClass(editTimeMs);
    return (
      <div className={`flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm ${urgencyClass} animate-fade-in`}>
        <span>⏱️</span>
        <span>Entry finalizes in {editTimeLabel.replace(/ left$/, "")}</span>
      </div>
    );
  }

  return null;
}
