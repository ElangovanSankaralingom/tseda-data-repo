"use client";

import { SectionCard, Field } from "./AccountUI";
import type { Profile } from "./types";

interface ProfileTabProps {
  draft: Profile;
  setDraft: React.Dispatch<React.SetStateAction<Profile>>;
  errors: Record<string, string>;
  shouldShowError: (key: string) => boolean;
}

export default function ProfileTab({ draft, setDraft, errors, shouldShowError }: ProfileTabProps) {
  return (
    <SectionCard title="Profile">
      <div className="space-y-5">
        <Field label="Email (keyed by email)" error={shouldShowError("email") ? errors.email : undefined} hint="Read-only">
          <input
            value={draft.email || ""}
            readOnly
            className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Official Name" hint="From faculty directory">
          <input
            value={draft.officialName ?? ""}
            readOnly
            className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Preferred Name (optional)">
          <input
            value={draft.userPreferredName ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, userPreferredName: e.target.value }))}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </Field>
      </div>
    </SectionCard>
  );
}
