"use client";

import { useEffect, useState } from "react";

const PARTICLE_COUNT = 24;
const COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ef4444", "#06b6d4"];

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

type Particle = {
  id: number;
  color: string;
  size: number;
  angle: number;
  velocity: number;
  spin: number;
  shape: "circle" | "rect";
};

function createParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
    size: randomBetween(4, 8),
    angle: randomBetween(0, 360),
    velocity: randomBetween(80, 180),
    spin: randomBetween(-180, 180),
    shape: (["circle", "rect"] as const)[Math.floor(Math.random() * 2)]!,
  }));
}

export default function ConfettiBurst({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setParticles(createParticles());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 1500);
    return () => clearTimeout(timer);
  }, [active]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible z-50" aria-hidden="true">
      {particles.map((p) => {
        const rad = (p.angle * Math.PI) / 180;
        const tx = Math.cos(rad) * p.velocity;
        const ty = Math.sin(rad) * p.velocity - 40;

        return (
          <div
            key={p.id}
            className="absolute left-1/2 top-1/2"
            style={{
              width: p.size,
              height: p.shape === "rect" ? p.size * 0.6 : p.size,
              backgroundColor: p.color,
              borderRadius: p.shape === "circle" ? "50%" : "1px",
              transform: "translate(-50%, -50%)",
              animation: "confetti-fly 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
              "--tx": `${tx}px`,
              "--ty": `${ty}px`,
              "--spin": `${p.spin}deg`,
            } as React.CSSProperties}
          />
        );
      })}
    </div>
  );
}
