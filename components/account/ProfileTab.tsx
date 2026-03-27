"use client";

import { useTranslation } from "@/lib/i18n/useTranslation";
import { SectionCard, Field } from "./AccountUI";
import type { Profile } from "./types";

export default function ProfileTab({ draft, setDraft, errors, shouldShowError }: { draft: Profile; setDraft: React.Dispatch<React.SetStateAction<Profile>>; errors: Record<string, string>; shouldShowError: (key: string) => boolean }) {
  const { t } = useTranslation();
  return (
    <SectionCard title={t("account.profile")}>
      <div className="space-y-5">
        <Field label={t("account.email")} error={shouldShowError("email") ? errors.email : undefined} hint={t("account.readOnly")}>
          <input
            value={draft.email || ""}
            readOnly
            className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm"
          />
        </Field>

        <Field label={t("account.officialName")} hint={t("account.fromFacultyDirectory")}>
          <input
            value={draft.officialName ?? ""}
            readOnly
            className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm"
          />
        </Field>

        <Field label={t("account.preferredNameOptional")}>
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
