"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";

function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevUrl = useRef("");

  useEffect(() => {
    const url = `${pathname}?${searchParams?.toString() ?? ""}`;
    if (prevUrl.current && url !== prevUrl.current) {
      // Navigation detected — show bar
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
       
      setProgress(30);

      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        setProgress(70);
        timerRef.current = setTimeout(() => {
          setProgress(100);
          timerRef.current = setTimeout(() => {
            setVisible(false);
            setProgress(0);
          }, 200);
        }, 150);
      }, 100);
    }
    prevUrl.current = url;

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5">
      <div
        className="h-full bg-[#1E3A5F] transition-all duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export default function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}
