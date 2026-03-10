"use client";

import { Unlock } from "lucide-react";

export default function StageTwoDivider() {
  return (
    <div className="relative my-6 animate-fade-in-up">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-dashed border-slate-300" />
      </div>
      <div className="relative flex justify-center">
        <span className="inline-flex items-center gap-2 bg-white px-4 py-1.5 rounded-full border border-slate-200 shadow-sm">
          <span className="flex size-5 items-center justify-center rounded-full bg-amber-100">
            <Unlock className="size-3 text-amber-600" />
          </span>
          <span className="text-xs font-semibold text-slate-700 tracking-wide uppercase">
            Supporting Documents
          </span>
        </span>
      </div>
      <p className="text-center mt-2 text-xs text-slate-500">
        Upload the required documents to complete this entry
      </p>
    </div>
  );
}
