"use client";

import { useEffect, useState } from "react";
import { getInitials, type Profile } from "./types";

export default function ProfileHeader({ draft, employeeLabel }: { draft: Profile; employeeLabel: string }) {
  const photo = draft.googlePhotoURL || "";
  const avatarFallback = getInitials(employeeLabel || draft.email || "");
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAvatarLoadFailed(false);
  }, [photo]);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 animate-fade-in-up">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <div className="ring-4 ring-white/20 rounded-full shadow-lg transition-shadow duration-500">
          <div className="h-20 w-20 overflow-hidden rounded-full bg-gradient-to-br from-slate-600 to-slate-900">
            {photo && !avatarLoadFailed ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={photo}
                alt="Profile"
                className="h-full w-full object-cover"
                onError={() => setAvatarLoadFailed(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-bold text-white">
                {avatarFallback}
              </div>
            )}
          </div>
        </div>
        <div className="text-center sm:text-left">
          <h1 className="text-2xl font-bold text-white">{employeeLabel}</h1>
          <p className="mt-0.5 text-sm text-slate-300">{draft.email || ""}</p>
          {draft.academic?.designation && (
            <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
              <span className="rounded-full bg-white/10 px-3 py-0.5 text-xs text-slate-200">
                {draft.academic.designation} Professor
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
