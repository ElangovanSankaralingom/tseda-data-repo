"use client";

import { useRef, useCallback, useEffect, useState } from "react";

/*
  ───────────────────────────────────────────────────────
   CURSOR GLOW — Interactive dot-grid reveal.

   A full-container overlay that tracks the mouse and
   renders a brighter dot-grid pattern only near the
   cursor. The effect: the static dot grid (0.045 opacity)
   "lights up" in a soft radius around your mouse, like
   a flashlight sweeping over graph paper.

   Implementation: a div with the same dot-grid pattern
   at higher opacity, masked by a radial gradient that
   follows the cursor. Only the area near the cursor
   shows through.

   Respects prefers-reduced-motion.
  ───────────────────────────────────────────────────────
*/

export default function CursorGlow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: -200, y: -200 });
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
      const el = containerRef.current?.parentElement;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    });
  }, []);

  const handleEnter = useCallback(() => {
    if (!reducedMotion.current) setVisible(true);
  }, []);

  const handleLeave = useCallback(() => {
    setVisible(false);
  }, []);

  useEffect(() => {
    const el = containerRef.current?.parentElement;
    if (!el) return;

    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseenter", handleEnter);
    el.addEventListener("mouseleave", handleLeave);
    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseenter", handleEnter);
      el.removeEventListener("mouseleave", handleLeave);
    };
  }, [handleMove, handleEnter, handleLeave]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-0"
      style={{
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease-out",
        maskImage: `radial-gradient(circle 180px at ${pos.x}px ${pos.y}px, black 0%, transparent 100%)`,
        WebkitMaskImage: `radial-gradient(circle 180px at ${pos.x}px ${pos.y}px, black 0%, transparent 100%)`,
      }}
    />
  );
}
