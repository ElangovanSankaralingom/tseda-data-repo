"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { SYSTEM } from "@/lib/constants/messages";

export default function NetworkStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setTimeout(() => setOnline(navigator.onLine), 0);
    function goOnline() { setOnline(true); }
    function goOffline() { setOnline(false); }

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 z-50 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 backdrop-blur-xl px-4 py-2.5 text-sm font-medium text-red-400 shadow-lg shadow-black/20 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:max-w-md animate-slide-in-right">
      <WifiOff className="size-4 shrink-0" />
      {SYSTEM.offline}
    </div>
  );
}
