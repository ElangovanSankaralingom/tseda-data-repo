"use client";

import DateField from "@/components/controls/DateField";
import SelectDropdown from "@/components/controls/SelectDropdown";
import { SectionCard, Field } from "./AccountUI";
import {
  cx,
  formatAadharNumber,
  normalizePanCardNumber,
  BLOOD_GROUP_OPTIONS,
  type BloodGroup,
  type Profile,
} from "./types";

interface PersonalTabProps {
  draft: Profile;
  setDraft: React.Dispatch<React.SetStateAction<Profile>>;
  errors: Record<string, string>;
  shouldShowError: (key: string) => boolean;
}

export default function PersonalTab({ draft, setDraft, errors, shouldShowError }: PersonalTabProps) {
  return (
    <SectionCard title="Personal Details">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date of Birth" error={shouldShowError("dob") ? errors.dob : undefined}>
          <DateField
            value={draft.personal?.dob ?? ""}
            onChange={(value) =>
              setDraft((d) => ({ ...d, personal: { ...(d.personal || {}), dob: value } }))
            }
            error={shouldShowError("dob") && !!errors.dob}
          />
        </Field>

        <Field label="Blood Group">
          <SelectDropdown
            value={draft.personal?.bloodGroup ?? ""}
            onChange={(value) =>
              setDraft((d) => ({
                ...d,
                personal: { ...(d.personal || {}), bloodGroup: (value || undefined) as BloodGroup | undefined },
              }))
            }
            options={BLOOD_GROUP_OPTIONS}
            placeholder="Select blood group"
          />
        </Field>

        <Field
          label="Aadhar Number"
          error={shouldShowError("aadharNumber") ? errors.aadharNumber : undefined}
          hint="12-digit format"
        >
          <input
            inputMode="numeric"
            maxLength={14}
            placeholder="1234 5678 9012"
            value={draft.personal?.aadharNumber ?? ""}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                personal: {
                  ...(d.personal || {}),
                  aadharNumber: formatAadharNumber(e.target.value),
                },
              }))
            }
            className={cx(
              "w-full rounded-lg border px-3 py-2 text-sm",
              shouldShowError("aadharNumber") && errors.aadharNumber ? "border-red-300" : "border-border"
            )}
          />
        </Field>

        <Field
          label="PAN Card Number"
          error={shouldShowError("panCardNumber") ? errors.panCardNumber : undefined}
          hint="ABCDE1234F"
        >
          <input
            autoCapitalize="characters"
            maxLength={10}
            placeholder="ABCDE1234F"
            value={draft.personal?.panCardNumber ?? ""}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                personal: {
                  ...(d.personal || {}),
                  panCardNumber: normalizePanCardNumber(e.target.value),
                },
              }))
            }
            className={cx(
              "w-full rounded-lg border px-3 py-2 text-sm",
              shouldShowError("panCardNumber") && errors.panCardNumber ? "border-red-300" : "border-border"
            )}
          />
        </Field>
      </div>
    </SectionCard>
  );
}
