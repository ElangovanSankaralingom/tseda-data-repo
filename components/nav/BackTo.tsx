"use client";

import { useRouter } from "next/navigation";
import { safeBack } from "@/lib/entryNavigation";

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M15 6 9 12l6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type BackToProps = {
  href: string;
  label?: string;
  disabled?: boolean;
  compact?: boolean;
  onClick?: (() => void | Promise<void>) | undefined;
};

export default function BackTo({
  href,
  label = "Back",
  disabled = false,
  compact = false,
  onClick,
}: BackToProps) {
  const router = useRouter();
  const handleClick = () => {
    if (disabled) return;
    if (onClick) {
      void onClick();
      return;
    }
    safeBack(router, href);
  };

  if (compact) {
    return (
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={handleClick}
        className={
          disabled
            ? "pointer-events-none inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-full border border-border text-muted-foreground opacity-50"
            : "inline-flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground cursor-pointer"
        }
      >
        <ArrowLeftIcon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className={
        disabled
          ? "pointer-events-none inline-flex cursor-not-allowed items-center gap-1.5 text-sm text-muted-foreground opacity-50"
          : "inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground cursor-pointer"
      }
    >
      <ArrowLeftIcon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}
