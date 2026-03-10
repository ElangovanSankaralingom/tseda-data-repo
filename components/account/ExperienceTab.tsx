"use client";

import { useMemo } from "react";
import DateField from "@/components/controls/DateField";
import { INDIAN_INSTITUTIONS } from "@/lib/institutions-in";
import { computeExperienceTotals } from "@/lib/experience";
import { SectionCard, Field, MiniButton } from "./AccountUI";
import CertificateBlock from "./ExperienceCertBlock";
import {
  cx,
  formatYMD,
  durationInclusive,
  rangeValid,
  todayISO,
  uuid,
  updateExperienceCategoryCertificate,
  type Experience,
  type FileMeta,
  type Profile,
  type SaveTabOptions,
  type TabKey,
} from "./types";

interface ExperienceTabProps {
  draft: Profile;
  setDraft: React.Dispatch<React.SetStateAction<Profile>>;
  errors: Record<string, string>;
  shouldShowError: (key: string) => boolean;
  saving: boolean;
  loading: boolean;
  experienceDirty: boolean;
  saveAttemptedTabs: Record<TabKey, boolean>;
  saveCurrentTab: (options: SaveTabOptions) => Promise<void>;
  showToast: (type: "ok" | "err", msg: string) => void;
  getErrorsForTab: (tab: TabKey) => Array<[string, string]>;
}

export default function ExperienceTab({
  draft,
  setDraft,
  errors,
  shouldShowError,
  saving,
  loading,
  experienceDirty,
  saveAttemptedTabs,
  saveCurrentTab,
  getErrorsForTab,
}: ExperienceTabProps) {
  const exp = useMemo(
    () => draft.experience ?? { lopPeriods: [], academicOutsideTCE: [], industry: [] },
    [draft.experience]
  );

  function setExp(updater: (e: Experience) => Experience) {
    setDraft((d) => {
      const e = d.experience ?? { lopPeriods: [], academicOutsideTCE: [], industry: [] };
      return { ...d, experience: updater(e) };
    });
  }

  const totals = useMemo(() => {
    return computeExperienceTotals({
      dateOfJoiningTCE: draft.academic?.dateOfJoiningTCE,
      lopPeriods: exp.lopPeriods,
      academicOutsideTCE: exp.academicOutsideTCE,
      industry: exp.industry,
    });
  }, [draft, exp]);

  function handleCertChange(category: "academicOutsideTCE" | "industry", entryId: string) {
    return async (meta: FileMeta | null) => {
      const e = draft.experience ?? { lopPeriods: [], academicOutsideTCE: [], industry: [] };
      const nextDraft = {
        ...draft,
        experience: updateExperienceCategoryCertificate(e, category, entryId, meta),
      };
      setDraft(nextDraft);
      await saveCurrentTab({ tab: "experience", draftOverride: nextDraft });
    };
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title="Current TCE Experience (Auto)"
        subtitle="Calculated from joining date minus LOP. Updates automatically."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground">TCE Experience (after LOP)</div>
            <div className="mt-1 text-lg font-semibold">{formatYMD(totals.tce)}</div>
          </div>
          <div className="rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground">Academic Total</div>
            <div className="mt-1 text-lg font-semibold">{formatYMD(totals.academicTotal)}</div>
          </div>
          <div className="rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground">Overall Total</div>
            <div className="mt-1 text-lg font-semibold">{formatYMD(totals.overallTotal)}</div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Leave on Loss of Pay (LOP)" subtitle="LOP periods must not overlap and must be within Joining Date..Today.">
        <div className="flex justify-end">
          <MiniButton
            onClick={() =>
              setExp((e) => ({
                ...e,
                lopPeriods: [...e.lopPeriods, { id: uuid(), startDate: todayISO(), endDate: todayISO() }],
              }))
            }
          >
            + Add LOP
          </MiniButton>
        </div>

        <div className="mt-4 space-y-3">
          {exp.lopPeriods.length === 0 ? (
            <div className="text-sm text-muted-foreground">No LOP periods added.</div>
          ) : null}

          {exp.lopPeriods.map((lop) => {
            const duration =
              rangeValid(lop.startDate, lop.endDate) ? formatYMD(durationInclusive(lop.startDate, lop.endDate)) : "";
            return (
              <div key={lop.id} className="rounded-xl border border-border p-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <Field
                    label="Start date"
                    error={shouldShowError(`lop.${lop.id}`) ? errors[`lop.${lop.id}`] : undefined}
                    hint={duration ? `Duration: ${duration}` : undefined}
                  >
                    <DateField
                      value={lop.startDate}
                      onChange={(value) =>
                        setExp((e) => ({
                          ...e,
                          lopPeriods: e.lopPeriods.map((x) => (x.id === lop.id ? { ...x, startDate: value } : x)),
                        }))
                      }
                      error={shouldShowError(`lop.${lop.id}`) && !!errors[`lop.${lop.id}`]}
                    />
                  </Field>

                  <Field label="End date">
                    <DateField
                      value={lop.endDate}
                      onChange={(value) =>
                        setExp((e) => ({
                          ...e,
                          lopPeriods: e.lopPeriods.map((x) => (x.id === lop.id ? { ...x, endDate: value } : x)),
                        }))
                      }
                    />
                  </Field>

                  <MiniButton
                    variant="danger"
                    onClick={() => setExp((e) => ({ ...e, lopPeriods: e.lopPeriods.filter((x) => x.id !== lop.id) }))}
                  >
                    Delete
                  </MiniButton>
                </div>
                {shouldShowError(`lop.${lop.id}`) && errors[`lop.${lop.id}`] ? (
                  <div className="mt-2 text-xs text-red-600">{errors[`lop.${lop.id}`]}</div>
                ) : null}
                <div className="mt-3 flex justify-end">
                  {experienceDirty ? (
                    <MiniButton
                      onClick={() => void saveCurrentTab({ tab: "experience" })}
                      disabled={saving || loading || (saveAttemptedTabs.experience && getErrorsForTab("experience").length > 0) || !experienceDirty}
                    >
                      Save this section
                    </MiniButton>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Academic Experience Outside TCE" subtitle="No overlaps within list and no overlaps with Industry. Certificate mandatory.">
        <div className="flex justify-end">
          <MiniButton
            onClick={() =>
              setExp((e) => ({
                ...e,
                academicOutsideTCE: [
                  ...e.academicOutsideTCE,
                  { id: uuid(), institution: "", startDate: todayISO(), endDate: todayISO(), certificate: null },
                ],
              }))
            }
          >
            + Add Outside Academic
          </MiniButton>
        </div>

        <datalist id="indian-institutions">
          {INDIAN_INSTITUTIONS.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <div className="mt-4 space-y-3">
          {exp.academicOutsideTCE.length === 0 ? (
            <div className="text-sm text-muted-foreground">No entries.</div>
          ) : null}

          {exp.academicOutsideTCE.map((a) => {
            const duration =
              rangeValid(a.startDate, a.endDate) ? formatYMD(durationInclusive(a.startDate, a.endDate)) : "";

            return (
              <div key={a.id} className="rounded-xl border border-border p-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Institution"
                    error={shouldShowError(`ao.inst.${a.id}`) ? errors[`ao.inst.${a.id}`] : undefined}
                    hint="Type to search; custom allowed"
                  >
                    <input
                      list="indian-institutions"
                      value={a.institution}
                      onChange={(ev) =>
                        setExp((e) => ({
                          ...e,
                          academicOutsideTCE: e.academicOutsideTCE.map((x) =>
                            x.id === a.id ? { ...x, institution: ev.target.value } : x
                          ),
                        }))
                      }
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                    />
                  </Field>

                  <div className="grid gap-3 grid-cols-2">
                    <Field
                      label="Start"
                      error={
                        shouldShowError(`ao.range.${a.id}`) || shouldShowError(`ao.overlap.${a.id}`) || shouldShowError(`cross.${a.id}`)
                          ? errors[`ao.range.${a.id}`] || errors[`ao.overlap.${a.id}`] || errors[`cross.${a.id}`]
                          : undefined
                      }
                      hint={duration ? `Duration: ${duration}` : undefined}
                    >
                      <DateField
                        value={a.startDate}
                        onChange={(value) =>
                          setExp((e) => ({
                            ...e,
                            academicOutsideTCE: e.academicOutsideTCE.map((x) =>
                              x.id === a.id ? { ...x, startDate: value } : x
                            ),
                          }))
                        }
                        error={!!(
                          (shouldShowError(`ao.range.${a.id}`) || shouldShowError(`ao.overlap.${a.id}`) || shouldShowError(`cross.${a.id}`)) &&
                          (errors[`ao.range.${a.id}`] || errors[`ao.overlap.${a.id}`] || errors[`cross.${a.id}`])
                        )}
                      />
                    </Field>

                    <Field
                      label="End"
                      error={
                        shouldShowError(`ao.range.${a.id}`) || shouldShowError(`ao.overlap.${a.id}`) || shouldShowError(`cross.${a.id}`)
                          ? errors[`ao.range.${a.id}`] || errors[`ao.overlap.${a.id}`] || errors[`cross.${a.id}`]
                          : undefined
                      }
                    >
                      <DateField
                        value={a.endDate}
                        onChange={(value) =>
                          setExp((e) => ({
                            ...e,
                            academicOutsideTCE: e.academicOutsideTCE.map((x) =>
                              x.id === a.id ? { ...x, endDate: value } : x
                            ),
                          }))
                        }
                        error={!!(
                          (shouldShowError(`ao.range.${a.id}`) || shouldShowError(`ao.overlap.${a.id}`) || shouldShowError(`cross.${a.id}`)) &&
                          (errors[`ao.range.${a.id}`] || errors[`ao.overlap.${a.id}`] || errors[`cross.${a.id}`])
                        )}
                      />
                    </Field>
                  </div>
                </div>

                <CertificateBlock
                  category="academicOutsideTCE"
                  entryId={a.id}
                  certificate={a.certificate}
                  certErrorKey={`ao.cert.${a.id}`}
                  errors={errors}
                  shouldShowError={shouldShowError}
                  onCertificateChange={handleCertChange("academicOutsideTCE", a.id)}
                />

                <div className="flex justify-end">
                  <MiniButton
                    variant="danger"
                    onClick={() =>
                      setExp((e) => ({ ...e, academicOutsideTCE: e.academicOutsideTCE.filter((x) => x.id !== a.id) }))
                    }
                  >
                    Delete entry
                  </MiniButton>
                </div>

                {shouldShowError(`cross.${a.id}`) && errors[`cross.${a.id}`] ? <div className="text-xs text-red-600">{errors[`cross.${a.id}`]}</div> : null}
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Industry Experience" subtitle="Role + certificate mandatory. No overlaps within list and no overlaps with Academic Outside TCE.">
        <div className="flex justify-end">
          <MiniButton
            onClick={() =>
              setExp((e) => ({
                ...e,
                industry: [
                  ...e.industry,
                  { id: uuid(), organization: "", role: "", startDate: todayISO(), endDate: todayISO(), certificate: null },
                ],
              }))
            }
          >
            + Add Industry
          </MiniButton>
        </div>

        <div className="mt-4 space-y-3">
          {exp.industry.length === 0 ? <div className="text-sm text-muted-foreground">No entries.</div> : null}

          {exp.industry.map((x) => {
            const duration =
              rangeValid(x.startDate, x.endDate) ? formatYMD(durationInclusive(x.startDate, x.endDate)) : "";

            return (
              <div key={x.id} className="rounded-xl border border-border p-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Company / Organization" error={shouldShowError(`in.org.${x.id}`) ? errors[`in.org.${x.id}`] : undefined}>
                    <input
                      value={x.organization}
                      onChange={(ev) =>
                        setExp((e) => ({
                          ...e,
                          industry: e.industry.map((it) => (it.id === x.id ? { ...it, organization: ev.target.value } : it)),
                        }))
                      }
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                    />
                  </Field>

                  <Field label="Role (mandatory)" error={shouldShowError(`in.role.${x.id}`) ? errors[`in.role.${x.id}`] : undefined}>
                    <input
                      value={x.role}
                      onChange={(ev) =>
                        setExp((e) => ({
                          ...e,
                          industry: e.industry.map((it) => (it.id === x.id ? { ...it, role: ev.target.value } : it)),
                        }))
                      }
                      className={cx(
                        "w-full rounded-lg border px-3 py-2 text-sm",
                        shouldShowError(`in.role.${x.id}`) && errors[`in.role.${x.id}`] ? "border-red-300" : "border-border"
                      )}
                    />
                  </Field>

                  <div className="grid gap-3 grid-cols-2 sm:col-span-2">
                    <Field
                      label="Start"
                      error={
                        shouldShowError(`in.range.${x.id}`) || shouldShowError(`in.overlap.${x.id}`) || shouldShowError(`cross.${x.id}`)
                          ? errors[`in.range.${x.id}`] || errors[`in.overlap.${x.id}`] || errors[`cross.${x.id}`]
                          : undefined
                      }
                      hint={duration ? `Duration: ${duration}` : undefined}
                    >
                      <DateField
                        value={x.startDate}
                        onChange={(value) =>
                          setExp((e) => ({
                            ...e,
                            industry: e.industry.map((it) => (it.id === x.id ? { ...it, startDate: value } : it)),
                          }))
                        }
                        error={!!(
                          (shouldShowError(`in.range.${x.id}`) || shouldShowError(`in.overlap.${x.id}`) || shouldShowError(`cross.${x.id}`)) &&
                          (errors[`in.range.${x.id}`] || errors[`in.overlap.${x.id}`] || errors[`cross.${x.id}`])
                        )}
                      />
                    </Field>

                    <Field
                      label="End"
                      error={
                        shouldShowError(`in.range.${x.id}`) || shouldShowError(`in.overlap.${x.id}`) || shouldShowError(`cross.${x.id}`)
                          ? errors[`in.range.${x.id}`] || errors[`in.overlap.${x.id}`] || errors[`cross.${x.id}`]
                          : undefined
                      }
                    >
                      <DateField
                        value={x.endDate}
                        onChange={(value) =>
                          setExp((e) => ({
                            ...e,
                            industry: e.industry.map((it) => (it.id === x.id ? { ...it, endDate: value } : it)),
                          }))
                        }
                        error={!!(
                          (shouldShowError(`in.range.${x.id}`) || shouldShowError(`in.overlap.${x.id}`) || shouldShowError(`cross.${x.id}`)) &&
                          (errors[`in.range.${x.id}`] || errors[`in.overlap.${x.id}`] || errors[`cross.${x.id}`])
                        )}
                      />
                    </Field>
                  </div>
                </div>

                <CertificateBlock
                  category="industry"
                  entryId={x.id}
                  certificate={x.certificate}
                  certErrorKey={`in.cert.${x.id}`}
                  errors={errors}
                  shouldShowError={shouldShowError}
                  onCertificateChange={handleCertChange("industry", x.id)}
                />

                <div className="flex justify-end">
                  <MiniButton
                    variant="danger"
                    onClick={() => setExp((e) => ({ ...e, industry: e.industry.filter((it) => it.id !== x.id) }))}
                  >
                    Delete entry
                  </MiniButton>
                </div>

                {shouldShowError(`cross.${x.id}`) && errors[`cross.${x.id}`] ? <div className="text-xs text-red-600">{errors[`cross.${x.id}`]}</div> : null}
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Totals" subtitle="Totals update automatically.">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground">Academic Outside TCE</div>
            <div className="mt-1 text-lg font-semibold">{formatYMD(totals.academicOutside)}</div>
          </div>
          <div className="rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground">Industry Total</div>
            <div className="mt-1 text-lg font-semibold">{formatYMD(totals.industryTotal)}</div>
          </div>
          <div className="rounded-xl border border-border p-4">
            <div className="text-xs text-muted-foreground">Overall Total</div>
            <div className="mt-1 text-lg font-semibold">{formatYMD(totals.overallTotal)}</div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
