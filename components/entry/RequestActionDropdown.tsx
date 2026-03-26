"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";

export default function RequestActionDropdown({
  editRequestPending = false,
  deleteRequestPending = false,
  requesting = false,
  onRequestEdit,
  onRequestDelete,
  onCancelRequest,
}: {
  editRequestPending?: boolean;
  deleteRequestPending?: boolean;
  requesting?: boolean;
  onRequestEdit: () => void;
  onRequestDelete: () => void;
  onCancelRequest?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [requestSent, setRequestSent] = useState<"edit" | "delete" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  // Auto-focus first menu item when dropdown opens
  useEffect(() => {
    if (open && ref.current) {
      const firstItem = ref.current.querySelector('[role="menuitem"]') as HTMLElement;
      firstItem?.focus();
    }
  }, [open]);

  // Raise parent card z-index when open so dropdown isn't clipped by sibling cards
  useEffect(() => {
    if (!ref.current) return;
    const card = ref.current.closest("[data-entry-card]");
    if (card) {
      (card as HTMLElement).style.zIndex = open ? "50" : "";
    }
  }, [open]);

  const hasPending = editRequestPending || deleteRequestPending;

  // If a request is pending, show cancel button instead of dropdown
  if (hasPending && onCancelRequest) {
    return (
      <button
        type="button"
        onClick={onCancelRequest}
        disabled={requesting}
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-transparent px-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-all duration-150 hover:bg-[var(--color-dropdown-hover)] active:scale-[0.97] disabled:opacity-50"
      >
        Cancel Request
      </button>
    );
  }

  // After clicking a request action, show greyed out confirmation text
  if (requestSent) {
    return (
      <span className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-sm font-medium text-[var(--color-text-muted)] cursor-not-allowed">
        {requestSent === "edit" ? "Edit Request Sent" : "Delete Request Sent"}
      </span>
    );
  }

  const handleRequestEdit = () => {
    if (requesting) return;
    setRequestSent("edit");
    setOpen(false);
    onRequestEdit();
  };

  const handleRequestDelete = () => {
    if (requesting) return;
    setRequestSent("delete");
    setOpen(false);
    onRequestDelete();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={requesting}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-transparent px-2.5 text-sm font-medium text-purple-600 transition-all duration-150 hover:bg-purple-50 active:scale-[0.97] disabled:opacity-50"
      >
        Request Action
        <ChevronDown className={`size-3.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] py-1 shadow-lg">
          <button
            type="button"
            role="menuitem"
            onClick={handleRequestEdit}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); (e.currentTarget.nextElementSibling as HTMLElement)?.focus(); }
              if (e.key === "ArrowUp") { e.preventDefault(); (e.currentTarget.previousElementSibling as HTMLElement)?.focus(); }
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-dropdown-hover)]"
          >
            <Pencil className="size-3.5 text-[var(--color-text-secondary)]" />
            Request Edit
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleRequestDelete}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); (e.currentTarget.nextElementSibling as HTMLElement)?.focus(); }
              if (e.key === "ArrowUp") { e.preventDefault(); (e.currentTarget.previousElementSibling as HTMLElement)?.focus(); }
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
          >
            <Trash2 className="size-3.5 text-red-400" />
            Request Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}
