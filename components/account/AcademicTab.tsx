"use client";

import DateField from "@/components/controls/DateField";
import SelectDropdown from "@/components/controls/SelectDropdown";
import { SectionCard, Field } from "./AccountUI";
import {
  cx,
  DESIGNATION_OPTIONS,
  PHD_STATUS_OPTIONS,
  type Designation,
  type PhdStatus,
  type Profile,
} from "./types";

interface AcademicTabProps {
  draft: Profile;
  setDraft: React.Dispatch<React.SetStateAction<Profile>>;
  errors: Record<string, string>;
  shouldShowError: (key: string) => boolean;
}

export default function AcademicTab({ draft, setDraft, errors, shouldShowError }: AcademicTabProps) {
  return (
    <SectionCard title="Academic Details">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Employee ID (6 digits)"
          error={shouldShowError("employeeId") ? errors.employeeId : undefined}
          hint="Exactly 6 digits"
        >
          <input
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={draft.academic?.employeeId ?? ""}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                academic: {
                  ...(d.academic || {}),
                  employeeId: e.target.value.replace(/\D/g, "").slice(0, 6),
                },
              }))
            }
            className={cx(
              "w-full rounded-lg border px-3 py-2 text-sm",
              shouldShowError("employeeId") && errors.employeeId ? "border-red-300" : "border-border"
            )}
          />
        </Field>

        <Field label="Date of Joining TCE" error={shouldShowError("doj") ? errors.doj : undefined}>
          <DateField
            value={draft.academic?.dateOfJoiningTCE ?? ""}
            onChange={(value) =>
              setDraft((d) => ({
                ...d,
                academic: { ...(d.academic || {}), dateOfJoiningTCE: value },
              }))
            }
            error={shouldShowError("doj") && !!errors.doj}
          />
        </Field>

        <Field label="Current Designation">
          <SelectDropdown
            value={draft.academic?.designation ?? ""}
            onChange={(value) =>
              setDraft((d) => ({
                ...d,
                academic: {
                  ...(d.academic || {}),
                  designation: (value || undefined) as Designation | undefined,
                },
              }))
            }
            options={DESIGNATION_OPTIONS}
            placeholder="Select designation"
          />
        </Field>

        <Field label="Ph.D. Status">
          <SelectDropdown
            value={draft.academic?.phdStatus ?? ""}
            onChange={(value) =>
              setDraft((d) => ({
                ...d,
                academic: {
                  ...(d.academic || {}),
                  phdStatus: (value || undefined) as PhdStatus | undefined,
                },
              }))
            }
            options={PHD_STATUS_OPTIONS}
            placeholder="Select Ph.D. status"
          />
        </Field>
      </div>
    </SectionCard>
  );
}
