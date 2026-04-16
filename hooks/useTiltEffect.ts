"use client";

import { useRef, useCallback, useState, useEffect } from "react";

/*
  ───────────────────────────────────────────────────────
   useTiltEffect — Holographic 3D card tilt.

   Tracks mouse position relative to card center and
   returns CSS transform + a light-reflection position.
   Cards physically rotate in 3D space, and a specular
   highlight slides across the surface.

   This is the SIGNATURE interaction — the thing nobody
   else has. Treat it like a holographic trading card.

   Usage:
     const { ref, style, lightStyle, isHovered } = useTiltEffect();
     <div ref={ref} style={style}>
       <div style={lightStyle} /> // specular reflection
       ...content
     </div>
  ───────────────────────────────────────────────────────
*/

type TiltState = {
  rotateX: number;
  rotateY: number;
  lightX: number;
  lightY: number;
};

const INITIAL: TiltState = { rotateX: 0, rotateY: 0, lightX: 50, lightY: 50 };
const MAX_TILT = 1; // degrees — barely perceptible, just enough to feel alive

export function useTiltEffect(maxTilt: number = MAX_TILT) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<TiltState>(INITIAL);
  const [isHovered, setIsHovered] = useState(false);
  const rafRef = useRef<number>(0);
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (prefersReducedMotion.current) return;
      const el = ref.current;
      if (!el) return;

      // Cancel any pending frame to avoid stacking
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // -1 to 1 range from center
        const normalX = (e.clientX - centerX) / (rect.width / 2);
        const normalY = (e.clientY - centerY) / (rect.height / 2);

        // Clamp to [-1, 1]
        const clampedX = Math.max(-1, Math.min(1, normalX));
        const clampedY = Math.max(-1, Math.min(1, normalY));

        setTilt({
          // Invert Y for natural tilt direction (mouse up = card tilts toward you)
          rotateX: -clampedY * maxTilt,
          rotateY: clampedX * maxTilt,
          // Light position as percentage (follows cursor)
          lightX: ((clampedX + 1) / 2) * 100,
          lightY: ((clampedY + 1) / 2) * 100,
        });
      });
    },
    [maxTilt]
  );

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setIsHovered(false);
    setTilt(INITIAL);
  }, []);

  const style: React.CSSProperties = {
    transform: isHovered
      ? `perspective(800px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) scale3d(1.002, 1.002, 1.002)`
      : "perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
    transition: isHovered
      ? "transform 0.1s ease-out"
      : "transform 0.4s ease-out",
    transformStyle: "preserve-3d" as const,
    willChange: isHovered ? "transform" : "auto",
  };

  // Accent-tinted light reflection — subtle, not a flashlight
  // Uses var(--color-primary) so it aligns with the theme palette
  const lightStyle: React.CSSProperties = {
    position: "absolute" as const,
    inset: 0,
    borderRadius: "inherit",
    pointerEvents: "none" as const,
    opacity: isHovered ? 0.015 : 0,
    transition: "opacity 0.4s ease-out",
    background: isHovered
      ? `radial-gradient(ellipse at ${tilt.lightX}% ${tilt.lightY}%, var(--color-primary) 0%, transparent 60%)`
      : "none",
  };

  return {
    ref,
    style,
    lightStyle,
    isHovered,
    handlers: {
      onMouseMove: handleMouseMove,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
    },
  };
}
