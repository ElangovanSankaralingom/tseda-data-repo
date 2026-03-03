"use client";

import type { EditLockState } from "@/lib/gamification";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7 10V7a5 5 0 0 1 10 0v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function getBadgeText(lockState: EditLockState) {
  if (lockState.isLocked) return "Finalised";
  if (lockState.daysRemaining <= 0) return "Finalise today";
  if (lockState.daysRemaining === 1) return "Finalise in 1 day";
  return `Finalise in ${lockState.daysRemaining} days`;
}

function getBadgeClass(lockState: EditLockState) {
  if (lockState.isLocked) {
    return "border-border bg-muted text-muted-foreground";
  }

  if (lockState.daysRemaining <= 2) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (lockState.daysRemaining <= 5) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-border bg-background text-muted-foreground";
}

export default function FinalisationBadge({
  lockState,
  variant = "compact",
}: {
  lockState: EditLockState;
  variant?: "compact";
}) {
  return (
    <div
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        variant === "compact" && "whitespace-nowrap",
        getBadgeClass(lockState)
      )}
    >
      {lockState.isLocked ? <LockIcon /> : null}
      <span>{getBadgeText(lockState)}</span>
    </div>
  );
}
