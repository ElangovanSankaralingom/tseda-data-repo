"use client";

import { useRef, useCallback, useEffect, useState } from "react";

/*
  ───────────────────────────────────────────────────────
   CURSOR GLOW — Interactive dot-grid reveal.

   A full-viewport overlay that tracks the mouse and
   renders a brighter dot-grid pattern only near the
   cursor. The effect: the static dot grid "lights up"
   in a soft radius around your mouse.

   Uses position:fixed + window-level mouse tracking.
   Lives in ShellClient for global coverage.

   The glow is clipped to the top ~60% of the viewport
   (matching the static dot overlay fade) so dots only
   appear in the header+hero zone.

   Respects prefers-reduced-motion.
  ───────────────────────────────────────────────────────
*/

export default function CursorGlow() {
  const [pos, setPos] = useState({ x: -300, y: -300 });
  const [visible, setVisible] = useState(false);
  const rafRef = useRef(0);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const handleMove = useCallback((e: MouseEvent) => {
    if (reducedMotion.current) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      setPos({ x: e.clientX, y: e.clientY });
    });
  }, []);

  const handleEnter = useCallback(() => {
    if (!reducedMotion.current) setVisible(true);
  }, []);

  const handleLeave = useCallback(() => {
    setVisible(false);
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMove);
    document.documentElement.addEventListener("mouseenter", handleEnter);
    document.documentElement.addEventListener("mouseleave", handleLeave);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      document.documentElement.removeEventListener("mouseenter", handleEnter);
      document.documentElement.removeEventListener("mouseleave", handleLeave);
    };
  }, [handleMove, handleEnter, handleLeave]);

  /* Compound mask: cursor spotlight AND vertical fade.
     CSS mask-composite: intersect means both masks must pass.
     The cursor circle + the vertical gradient combine so
     the glow only appears near the cursor AND within the
     top portion of the viewport. */
  const cursorMask = `radial-gradient(circle 220px at ${pos.x}px ${pos.y}px, black 0%, transparent 100%)`;
  const verticalFade = "linear-gradient(to bottom, black 0%, black 40%, transparent 65%)";

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 cursor-glow-dots"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease-out",
        maskImage: `${cursorMask}, ${verticalFade}`,
        WebkitMaskImage: `${cursorMask}, ${verticalFade}`,
        maskComposite: "intersect",
        WebkitMaskComposite: "source-in" as string,
      }}
    />
  );
}
