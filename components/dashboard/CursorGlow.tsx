"use client";

import { useRef, useCallback, useEffect, useState } from "react";

/*
  ───────────────────────────────────────────────────────
   CURSOR GLOW — Interactive dot-grid reveal.

   A full-viewport overlay that tracks the mouse and
   renders a brighter dot-grid pattern only near the
   cursor. The effect: the static dot grid "lights up"
   in a soft radius around your mouse, like a flashlight
   sweeping over graph paper.

   Uses position:fixed + window-level mouse tracking so
   it can be mounted ANYWHERE and still cover the full
   viewport. Lives in ShellClient for global coverage.

   The dot size matches the body dot-grid via the
   .cursor-glow-dots CSS class (responsive 24→32px).

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

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 cursor-glow-dots"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease-out",
        maskImage: `radial-gradient(circle 220px at ${pos.x}px ${pos.y}px, black 0%, transparent 100%)`,
        WebkitMaskImage: `radial-gradient(circle 220px at ${pos.x}px ${pos.y}px, black 0%, transparent 100%)`,
      }}
    />
  );
}
