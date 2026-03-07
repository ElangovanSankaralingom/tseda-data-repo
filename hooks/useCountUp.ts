"use client";
import { useEffect, useState } from "react";

export function useCountUp(target: number, duration = 500) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target <= 0) { setCount(0); return; }
    const start = performance.now();
    let raf: number;
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return count;
}
