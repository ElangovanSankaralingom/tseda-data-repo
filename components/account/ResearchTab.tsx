"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Network, Plus, Trash2, Loader2, Save } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import FacultySelect from "@/components/controls/FacultySelect";
import { uuid } from "@/lib/utils/idHelpers";

/**
 * Research tab — Ph.D. milestones on the PROFILE (Elan's S7 ruling).
 * Supervisors and scholars are TAGGED Internal (TCE faculty via registry
 * picker — creates a network edge) or External (free text). The read-only
 * network panel shows faculty who tagged YOU as their supervisor. Viva
 * dates decide which award year each milestone counts in (phd_awarded 15,
 * phd_guided 12/scholar). Self-contained fetch/save via /api/me/research.
 */

type PersonType = "Internal" | "External";

type OwnPhd = {
  status: "None" | "Pursuing" | "Awarded";
  university: string;
  thesisTitle: string;
  supervisorType: PersonType;
  supervisorName: string;
  supervisorEmail: string;
  vivaDate: string;
};

type GuidedScholar = {
  id: string;
  scholarType: PersonType;
  scholarName: string;
  scholarEmail: string;
  thesisTitle: string;
  university: string;
  vivaDate: string;
};

type ResearchProfile = {
  version: number;
  ownPhd: OwnPhd;
  guidedScholars: GuidedScholar[];
};

type SupervisionTag = {
  facultyEmail: string;
  facultyName: string;
  phdStatus: string;
  thesisTitle: string;
  vivaDate: string;
};

const EMPTY: ResearchProfile = {
  version: 1,
  ownPhd: {
    status: "None",
    university: "",
    thesisTitle: "",
    supervisorType: "External",
    supervisorName: "",
    supervisorEmail: "",
    vivaDate: "",
  },
  guidedScholars: [],
};

const inputClass =
  "w-full rounded-lg border border-[var(--color-input-border)] bg-[var(--color-input-bg)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus-ring)]";

function TypePills({
  value,
  onChange,
  internalLabel,
  externalLabel,
}: {
  value: PersonType;
  onChange: (next: PersonType) => void;
  internalLabel: string;
  externalLabel: string;
}) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--color-border-default)] p-0.5" style={{ background: "var(--color-surface-inset)" }}>
      {([["Internal", internalLabel], ["External", externalLabel]] as Array<[PersonType, string]>).map(([kind, label]) => (
        <button
          key={kind}
          type="button"
          onClick={() => onChange(kind)}
          className="rounded-md px-3 py-1 text-xs font-semibold transition-all duration-150"
          style={
            value === kind
              ? { background: "var(--color-button-primary-bg)", color: "var(--color-button-primary-text)" }
              : { color: "var(--color-text-tertiary)" }
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function ResearchTab() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<ResearchProfile>(EMPTY);
  const [taggedYou, setTaggedYou] = useState<SupervisionTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/me/research", { cache: "no-store" })
      .then(async (r) =>
        r.ok
          ? ((await r.json()) as { data?: { profile?: ResearchProfile; network?: { taggedYouAsSupervisor?: SupervisionTag[] } } })
          : null,
      )
      .then((body) => {
        if (!cancelled) {
          if (body?.data?.profile) setProfile({ ...EMPTY, ...body.data.profile });
          setTaggedYou(body?.data?.network?.taggedYouAsSupervisor ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update(mutate: (current: ResearchProfile) => ResearchProfile) {
    setProfile((current) => mutate(current));
    setDirty(true);
    setMessage(null);
  }

  function updateScholar(id: string, patch: Partial<GuidedScholar>) {
    update((c) => ({
      ...c,
      guidedScholars: c.guidedScholars.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/me/research", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const body = (await res.json()) as { data?: { profile?: ResearchProfile }; error?: { message?: string } };
      if (res.ok && body.data?.profile) {
        setProfile(body.data.profile);
        setDirty(false);
        setMessage({ type: "ok", text: t("research.saved") });
      } else {
        setMessage({ type: "err", text: body.error?.message ?? t("common.error") });
      }
    } catch {
      setMessage({ type: "err", text: t("common.error") });
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-glass-border)] p-6 text-sm text-[var(--color-text-muted)]">
        <Loader2 className="size-4 animate-spin" />
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Own Ph.D. ── */}
      <section className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-panel)] p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--color-primary)]/15">
            <GraduationCap className="size-4.5 text-[var(--color-primary)]" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{t("research.ownPhdTitle")}</h3>
            <p className="text-xs text-[var(--color-text-tertiary)]">{t("research.ownPhdHint")}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">{t("research.phdStatus")}</span>
            <select
              value={profile.ownPhd.status}
              onChange={(e) => update((c) => ({ ...c, ownPhd: { ...c.ownPhd, status: e.target.value as OwnPhd["status"] } }))}
              className={inputClass}
            >
              <option value="None">{t("research.statusNone")}</option>
              <option value="Pursuing">{t("research.statusPursuing")}</option>
              <option value="Awarded">{t("research.statusAwarded")}</option>
            </select>
          </label>

          {profile.ownPhd.status !== "None" && (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">{t("research.university")}</span>
                <input
                  value={profile.ownPhd.university || ""}
                  onChange={(e) => update((c) => ({ ...c, ownPhd: { ...c.ownPhd, university: e.target.value } }))}
                  className={inputClass}
                  placeholder={t("research.universityPlaceholder")}
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">{t("research.thesisTitle")}</span>
                <input
                  value={profile.ownPhd.thesisTitle || ""}
                  onChange={(e) => update((c) => ({ ...c, ownPhd: { ...c.ownPhd, thesisTitle: e.target.value } }))}
                  className={inputClass}
                  placeholder={t("research.thesisPlaceholder")}
                />
              </label>

              {/* Supervisor — the network edge */}
              <div className="sm:col-span-2 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">{t("research.supervisor")}</span>
                  <TypePills
                    value={profile.ownPhd.supervisorType}
                    onChange={(next) =>
                      update((c) => ({
                        ...c,
                        ownPhd: { ...c.ownPhd, supervisorType: next, supervisorName: "", supervisorEmail: "" },
                      }))
                    }
                    internalLabel={t("research.internalFaculty")}
                    externalLabel={t("research.external")}
                  />
                </div>
                {profile.ownPhd.supervisorType === "Internal" ? (
                  <FacultySelect
                    value={{ name: profile.ownPhd.supervisorName, email: profile.ownPhd.supervisorEmail }}
                    onChange={(next) =>
                      update((c) => ({
                        ...c,
                        ownPhd: { ...c.ownPhd, supervisorName: next.name, supervisorEmail: next.email },
                      }))
                    }
                    disabledEmails={new Set<string>()}
                    placeholder={t("research.searchFaculty")}
                  />
                ) : (
                  <input
                    value={profile.ownPhd.supervisorName || ""}
                    onChange={(e) => update((c) => ({ ...c, ownPhd: { ...c.ownPhd, supervisorName: e.target.value } }))}
                    className={inputClass}
                    placeholder={t("research.supervisorPlaceholder")}
                  />
                )}
              </div>

              {profile.ownPhd.status === "Awarded" && (
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">{t("research.vivaDate")}</span>
                  <input
                    type="date"
                    value={profile.ownPhd.vivaDate || ""}
                    onChange={(e) => update((c) => ({ ...c, ownPhd: { ...c.ownPhd, vivaDate: e.target.value } }))}
                    className={inputClass}
                  />
                  <span className="mt-1 block text-[11px] text-[var(--color-text-tertiary)]">{t("research.vivaDateHint")}</span>
                </label>
              )}
            </>
          )}
        </div>
      </section>

      {/* ── Guided scholars ── */}
      <section className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-panel)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{t("research.guidedTitle")}</h3>
            <p className="text-xs text-[var(--color-text-tertiary)]">{t("research.guidedHint")}</p>
          </div>
          <button
            type="button"
            onClick={() =>
              update((c) => ({
                ...c,
                guidedScholars: [
                  ...c.guidedScholars,
                  { id: uuid(), scholarType: "External", scholarName: "", scholarEmail: "", thesisTitle: "", university: "", vivaDate: "" },
                ],
              }))
            }
            className="flex items-center gap-1.5 rounded-xl border border-[var(--color-border-strong)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-raised)]"
          >
            <Plus className="size-4" />
            {t("research.addScholar")}
          </button>
        </div>

        {profile.guidedScholars.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-text-muted)]">{t("research.noScholars")}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {profile.guidedScholars.map((scholar, index) => (
              <li
                key={scholar.id}
                className="rounded-xl border border-[var(--color-border-subtle)] p-4"
                style={{ background: "var(--color-surface-panel-raised)" }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
                    {t("research.scholarLabel")} {index + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <TypePills
                      value={scholar.scholarType}
                      onChange={(next) => updateScholar(scholar.id, { scholarType: next, scholarName: "", scholarEmail: "" })}
                      internalLabel={t("research.internalFaculty")}
                      externalLabel={t("research.external")}
                    />
                    <button
                      type="button"
                      onClick={() => update((c) => ({ ...c, guidedScholars: c.guidedScholars.filter((s) => s.id !== scholar.id) }))}
                      aria-label={`${t("research.removeScholar")} ${index + 1}`}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--color-status-error)] transition-colors hover:bg-[var(--color-status-error-bg)]"
                    >
                      <Trash2 className="size-3.5" />
                      {t("research.removeScholar")}
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {scholar.scholarType === "Internal" ? (
                    <FacultySelect
                      value={{ name: scholar.scholarName, email: scholar.scholarEmail }}
                      onChange={(next) => updateScholar(scholar.id, { scholarName: next.name, scholarEmail: next.email })}
                      disabledEmails={new Set<string>()}
                      placeholder={t("research.searchFaculty")}
                    />
                  ) : (
                    <input
                      value={scholar.scholarName || ""}
                      onChange={(e) => updateScholar(scholar.id, { scholarName: e.target.value })}
                      className={inputClass}
                      placeholder={t("research.scholarNamePlaceholder")}
                    />
                  )}
                  <input
                    value={scholar.university || ""}
                    onChange={(e) => updateScholar(scholar.id, { university: e.target.value })}
                    className={inputClass}
                    placeholder={t("research.universityPlaceholder")}
                  />
                  <input
                    value={scholar.thesisTitle || ""}
                    onChange={(e) => updateScholar(scholar.id, { thesisTitle: e.target.value })}
                    className={inputClass}
                    placeholder={t("research.thesisPlaceholder")}
                  />
                  <label className="block">
                    <input
                      type="date"
                      value={scholar.vivaDate || ""}
                      onChange={(e) => updateScholar(scholar.id, { vivaDate: e.target.value })}
                      className={inputClass}
                    />
                    <span className="mt-1 block text-[11px] text-[var(--color-text-tertiary)]">{t("research.vivaDateHint")}</span>
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Network: scholars who tagged YOU ── */}
      {taggedYou.length > 0 && (
        <section className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-panel)] p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl" style={{ background: "var(--color-status-info-bg)" }}>
              <Network className="size-4.5" style={{ color: "var(--color-status-info)" }} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{t("research.networkTitle")}</h3>
              <p className="text-xs text-[var(--color-text-tertiary)]">{t("research.networkHint")}</p>
            </div>
          </div>
          <ul className="mt-3 space-y-2">
            {taggedYou.map((tag) => (
              <li
                key={tag.facultyEmail}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-[var(--color-border-subtle)] px-3.5 py-2.5 text-sm"
                style={{ background: "var(--color-surface-panel-raised)" }}
              >
                <span className="font-medium text-[var(--color-text-primary)]">{tag.facultyName}</span>
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  {tag.phdStatus}
                  {tag.thesisTitle ? ` — ${tag.thesisTitle}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Save ── */}
      <div className="flex items-center justify-between gap-3">
        {message ? (
          <p
            role="status"
            className="text-sm font-medium"
            style={{ color: message.type === "ok" ? "var(--color-status-success)" : "var(--color-status-error)" }}
          >
            {message.text}
          </p>
        ) : (
          <p className="text-xs text-[var(--color-text-tertiary)]">{t("research.awardNote")}</p>
        )}
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !dirty}
          className="flex items-center gap-1.5 rounded-xl bg-[var(--color-button-primary-bg)] px-4 py-2 text-sm font-bold text-[var(--color-button-primary-text)] transition-transform duration-150 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {saving ? t("research.saving") : t("research.save")}
        </button>
      </div>
    </div>
  );
}
