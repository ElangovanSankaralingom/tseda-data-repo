"use client";

import { useMemo, useState } from "react";
import DateField from "@/components/controls/DateField";
import { INDIAN_INSTITUTIONS } from "@/lib/institutions-in";
import { computeExperienceTotals } from "@/lib/experience";
import { SectionCard, Field, MiniButton, ProgressBar } from "./AccountUI";
import { uploadCertificateXHR } from "./uploadHelpers";
import {
  cx,
  formatYMD,
  durationInclusive,
  rangeValid,
  todayISO,
  uuid,
  getErrorMessage,
  findExperienceEntry,
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
  showToast,
  getErrorsForTab,
}: ExperienceTabProps) {
  const [pendingCertFile, setPendingCertFile] = useState<Record<string, File | null>>({});
  const [certProgress, setCertProgress] = useState<Record<string, number>>({});
  const [certBusy, setCertBusy] = useState<Record<string, boolean>>({});
  const [certError, setCertError] = useState<Record<string, string | null>>({});

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

  async function deleteCertificate(category: "academicOutsideTCE" | "industry", entryId: string) {
    try {
      const e = draft.experience ?? { lopPeriods: [], academicOutsideTCE: [], industry: [] };
      const entry = findExperienceEntry(e, category, entryId);
      const meta: FileMeta | null | undefined = entry?.certificate;

      if (!meta?.storedPath) {
        showToast("err", "File path missing. Re-upload the certificate once.");
        return;
      }

      const r = await fetch("/api/me/file", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storedPath: meta.storedPath }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Delete failed");

      const e2 = draft.experience ?? { lopPeriods: [], academicOutsideTCE: [], industry: [] };
      const nextDraft = {
        ...draft,
        experience: updateExperienceCategoryCertificate(e2, category, entryId, null),
      };

      setDraft(nextDraft);

      const key = `cert:${category}:${entryId}`;
      setPendingCertFile((m) => ({ ...m, [key]: null }));
      setCertProgress((m) => ({ ...m, [key]: 0 }));
      setCertBusy((m) => ({ ...m, [key]: false }));
      setCertError((m) => ({ ...m, [key]: null }));

      await saveCurrentTab({ tab: "experience", draftOverride: nextDraft });
    } catch (error: unknown) {
      showToast("err", getErrorMessage(error, "Delete failed."));
    }
  }

  async function uploadAndSaveCertificate(category: "academicOutsideTCE" | "industry", entryId: string) {
    const key = `cert:${category}:${entryId}`;
    const file = pendingCertFile[key];

    if (!file) {
      setCertError((m) => ({ ...m, [key]: "Select a file first." }));
      return;
    }

    const max = 20 * 1024 * 1024;
    const allowed =
      file.type === "application/pdf" || file.type === "image/png" || file.type === "image/jpeg";

    if (!allowed) {
      setCertError((m) => ({ ...m, [key]: "Only PDF/JPG/PNG allowed." }));
      return;
    }
    if (file.size > max) {
      setCertError((m) => ({ ...m, [key]: "Max file size is 20MB." }));
      return;
    }

    try {
      setCertError((m) => ({ ...m, [key]: null }));
      setCertBusy((m) => ({ ...m, [key]: true }));
      setCertProgress((m) => ({ ...m, [key]: 0 }));

      const meta = await uploadCertificateXHR({
        category,
        entryId,
        file,
        onProgress: (pct) => setCertProgress((m) => ({ ...m, [key]: pct })),
      });

      const e = draft.experience ?? { lopPeriods: [], academicOutsideTCE: [], industry: [] };
      const nextDraft = {
        ...draft,
        experience: updateExperienceCategoryCertificate(e, category, entryId, meta),
      };

      setDraft(nextDraft);

      setPendingCertFile((m) => ({ ...m, [key]: null }));
      setCertBusy((m) => ({ ...m, [key]: false }));
      setCertProgress((m) => ({ ...m, [key]: 100 }));

      await saveCurrentTab({ tab: "experience", draftOverride: nextDraft });
    } catch (error: unknown) {
      setCertBusy((m) => ({ ...m, [key]: false }));
      setCertError((m) => ({ ...m, [key]: getErrorMessage(error, "Upload failed.") }));
    }
  }

  function renderCertificateBlock(
    category: "academicOutsideTCE" | "industry",
    entryId: string,
    certificate: FileMeta | null | undefined,
    certErrorKey: string,
  ) {
    const key = `cert:${category}:${entryId}`;
    const pending = pendingCertFile[key];
    const busy = !!certBusy[key];
    const pct = certProgress[key] ?? 0;
    const localErr = certError[key];
    const canUploadAndSave = !busy && !!pending;

    return (
      <div className="rounded-xl border border-border p-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium">Certificate (mandatory)</div>

            {certificate ? (
              <div className="mt-1 text-xs text-muted-foreground">
                <a className="underline" href={certificate.url} target="_blank">
                  {certificate.fileName}
                </a>{" "}
                • {new Date(certificate.uploadedAt).toLocaleString()}
              </div>
            ) : shouldShowError(certErrorKey) ? (
              <div className="mt-1 text-xs text-red-600">{errors[certErrorKey] || "Certificate is mandatory."}</div>
            ) : null}

            <div className="mt-2 text-xs text-muted-foreground">
              {pending ? `Selected: ${pending.name}` : "Select a file to enable Upload & Save."}
            </div>

            {busy ? (
              <div className="mt-2 space-y-2">
                <ProgressBar value={pct} />
                <div className="text-xs text-muted-foreground">{pct}% uploading…</div>
              </div>
            ) : null}

            {localErr ? <div className="mt-2 text-xs text-red-600">{localErr}</div> : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {certificate ? (
              <MiniButton variant="danger" onClick={() => void deleteCertificate(category, entryId)} disabled={busy}>
                Delete Certificate
              </MiniButton>
            ) : null}

            <label
              className={cx(
                "inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-border px-3 text-sm",
                busy
                  ? "pointer-events-none cursor-not-allowed opacity-60"
                  : "cursor-pointer transition hover:bg-muted"
              )}
            >
              Choose file
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  e.currentTarget.value = "";
                  setPendingCertFile((m) => ({ ...m, [key]: f }));
                  setCertError((m) => ({ ...m, [key]: null }));
                  setCertProgress((m) => ({ ...m, [key]: 0 }));
                }}
              />
            </label>

            <MiniButton
              onClick={() => void uploadAndSaveCertificate(category, entryId)}
              disabled={!canUploadAndSave}
            >
              Upload & Save
            </MiniButton>
          </div>
        </div>
      </div>
    );
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

                {renderCertificateBlock("academicOutsideTCE", a.id, a.certificate, `ao.cert.${a.id}`)}

                <div className="flex justify-end">
                  <MiniButton
                    variant="danger"
                    onClick={() =>
                      setExp((e) => ({ ...e, academicOutsideTCE: e.academicOutsideTCE.filter((x) => x.id !== a.id) }))
                    }
                    disabled={!!certBusy[`cert:academicOutsideTCE:${a.id}`]}
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

                {renderCertificateBlock("industry", x.id, x.certificate, `in.cert.${x.id}`)}

                <div className="flex justify-end">
                  <MiniButton
                    variant="danger"
                    onClick={() => setExp((e) => ({ ...e, industry: e.industry.filter((it) => it.id !== x.id) }))}
                    disabled={!!certBusy[`cert:industry:${x.id}`]}
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
