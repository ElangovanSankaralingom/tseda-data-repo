"use client";

import { Unlock } from "lucide-react";

export default function StageTwoDivider() {
  return (
    <div className="my-6 animate-fade-in-up">
      <div className="flex items-center">
        <div className="flex-1 border-t border-dashed border-slate-300" />
        <span className="mx-4 inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 shadow-sm">
          <span className="flex size-5 items-center justify-center rounded-full bg-amber-100">
            <Unlock className="size-3 text-amber-600" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
            Supporting Documents
          </span>
        </span>
        <div className="flex-1 border-t border-dashed border-slate-300" />
      </div>
      <p className="mt-2 text-center text-xs text-slate-500">
        Upload the required documents to complete this entry
      </p>
    </div>
  );
}
