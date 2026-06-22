"use client";

import { cn } from "@/lib/utils";
import DumpColumn from "@/components/shell/DumpColumn";

/*
  ───────────────────────────────────────────────────────
   SIDEBAR DRAWER — Scratch Pad

   Layered slide-out panel with depth and personality.
   Uses theme CSS variables for palette-aware rendering.

   Layer stack (outside → in):
     0. Backdrop — dark blur, desaturated
     1. Positioning shell — handles slide animation
     2. Outer gradient border — bright top edge fading down
     3. Inner surface — deep dark with subtle warm shift
     4. Content — DumpColumn with padding
  ───────────────────────────────────────────────────────
*/

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

export default function SidebarDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {/* ── Layer 0: Backdrop ── */}
      <div
        className={cn(
          "fixed inset-0 z-40 transition-all duration-500",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        style={{
          backgroundColor: "var(--color-modal-overlay)",
          backdropFilter: "blur(28px) saturate(0.7) brightness(0.85)",
          WebkitBackdropFilter: "blur(28px) saturate(0.7) brightness(0.85)",
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── Layer 1: Panel Shell ── */}
      <div
        className={cn(
          "fixed z-50 top-[56px] left-0 bottom-0",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        style={{ padding: "8px 0 12px 8px" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Scratch pad"
      >
        <div
          className="flex flex-col h-full"
          style={{
            transform: open ? "translateX(0)" : "translateX(-360px)",
            opacity: open ? 1 : 0,
            transitionProperty: "transform, opacity",
            transitionDuration: "480ms, 350ms",
            transitionTimingFunction: EASE,
            transitionDelay: open ? "30ms" : "0ms",
            width: 340,
          }}
        >
          {/* ── Layer 2: Outer border shell ── */}
          <div
            className="flex-1 min-h-0 rounded-2xl overflow-hidden"
            style={{
              background: "linear-gradient(175deg, var(--color-border-strong) 0%, var(--color-border-subtle) 100%)",
              padding: "1px",
            }}
          >
            {/* ── Layer 3: Inner surface ── */}
            <div
              className="flex flex-col h-full rounded-[15px] overflow-hidden"
              style={{
                background: "var(--color-sidebar-bg)",
                boxShadow: [
                  "0 16px 56px -24px rgba(var(--shadow-ink),0.30)",
                  "0 4px 16px -8px rgba(var(--shadow-ink),0.18)",
                  "0 0 0 1px var(--color-border-subtle)",
                ].join(", "),
              }}
            >
              {/* ── Top accent line ── */}
              <div
                className="shrink-0 h-[2.5px]"
                style={{
                  background: `linear-gradient(90deg, transparent 2%, var(--color-primary) 25%, var(--color-primary-light) 50%, var(--color-primary) 75%, transparent 98%)`,
                  opacity: 0.5,
                }}
              />

              {/* ── Content area ── */}
              <div className="flex-1 min-h-0 px-5 pt-5 pb-4">
                <DumpColumn />
              </div>

              {/* ── Bottom edge ── */}
              <div
                className="shrink-0 h-px"
                style={{
                  background: "linear-gradient(90deg, transparent 5%, var(--color-divider) 50%, transparent 95%)",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
