"use client";

import Image from "next/image";
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
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--color-band-from)] to-[var(--color-band-to)] p-8 animate-fade-in-up">
      <div className="absolute inset-x-0 top-0 h-[3px] animate-bar-draw origin-center" style={{ background: "var(--color-text-on-accent)" }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(120% 80% at 6% -12%, var(--color-surface-on-accent), transparent 55%)" }} />
      <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <div className="ring-4 ring-[var(--color-surface-on-accent-strong)] rounded-full shadow-lg transition-shadow duration-500">
          <div className="h-20 w-20 overflow-hidden rounded-full bg-gradient-to-br from-[var(--color-band-from)] to-[var(--color-band-to)]">
            {photo && !avatarLoadFailed ? (
              <Image
                src={photo}
                alt="Profile"
                width={80}
                height={80}
                className="h-full w-full object-cover"
                onError={() => setAvatarLoadFailed(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-bold text-[var(--color-text-on-accent)]">
                {avatarFallback}
              </div>
            )}
          </div>
        </div>
        <div className="text-center sm:text-left">
          <h1 className="text-2xl font-bold text-[var(--color-text-on-accent)]">{employeeLabel}</h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-on-accent-muted)]">{draft.email || ""}</p>
          {draft.academic?.designation && (
            <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
              <span className="rounded-full bg-[var(--color-surface-on-accent)] px-3 py-0.5 text-xs text-[var(--color-text-on-accent-muted)]">
                {draft.academic.designation} Professor
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
