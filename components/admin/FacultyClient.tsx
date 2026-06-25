"use client";

import { useCallback, useState } from "react";
import { UserPlus, Users, Building2, X, Plus, Download } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

type FacultyStatus = "active" | "llp" | "inactive";
type FacultyRecord = { email: string; name: string; departments: string[]; status: FacultyStatus };
type Department = { id: string; label: string };
type Config = { faculty: FacultyRecord[]; departments: Department[] };

const cardStyle = { background: "var(--color-card-bg)", border: "1px solid var(--color-border-default)" } as const;
const inset = { background: "var(--color-surface-inset)", border: "1px solid var(--color-border-default)" } as const;

const STATUS_COLOR: Record<FacultyStatus, string> = {
  active: "var(--color-status-success)",
  llp: "var(--color-status-warning)",
  inactive: "var(--color-status-error)",
};

export default function FacultyClient({ initialConfig }: { initialConfig: Config }) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<Config>(initialConfig);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [bulk, setBulk] = useState("");
  const [deptLabel, setDeptLabel] = useState("");

  const post = useCallback(async (body: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/faculty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as Config & { error?: string };
      if (!res.ok) { setError(data.error || t("common.error")); return false; }
      setConfig({ faculty: data.faculty ?? [], departments: data.departments ?? [] });
      return true;
    } catch { setError(t("common.error")); return false; }
    finally { setBusy(false); }
  }, [t]);

  const deptLabelById = (id: string) => config.departments.find((d) => d.id === id)?.label ?? id;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "var(--color-status-error-bg)", border: "1px solid var(--color-status-error-border)", color: "var(--color-status-error)" }}>{error}</div>
      )}

      {/* ── Add faculty ── */}
      <section className="rounded-2xl p-5" style={cardStyle}>
        <div className="mb-3 flex items-center gap-2"><UserPlus className="size-4 text-[var(--color-text-secondary)]" /><h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{t("faculty.addTitle")}</h2></div>
        <div className="flex flex-wrap items-end gap-2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("faculty.emailPlaceholder")} className="min-w-[14rem] flex-1 rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none" style={inset} />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("faculty.namePlaceholder")} className="min-w-[10rem] flex-1 rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none" style={inset} />
          <button type="button" disabled={busy || !email.trim()} onClick={() => post({ action: "add", email: email.trim(), name: name.trim() || undefined }).then((ok) => { if (ok) { setEmail(""); setName(""); } })} className="rounded-lg px-4 py-2 text-sm font-semibold text-[var(--color-button-primary-text)] disabled:opacity-60" style={{ background: "var(--color-button-primary-bg)" }}>{t("faculty.add")}</button>
        </div>
        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">{t("faculty.bulkTitle")}</label>
          <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={t("faculty.bulkPlaceholder")} rows={3} className="w-full rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none" style={inset} />
          <button type="button" disabled={busy || !bulk.trim()} onClick={() => post({ action: "addBulk", emails: bulk.split(/[\s,;]+/).filter(Boolean) }).then((ok) => { if (ok) setBulk(""); })} className="mt-2 rounded-lg px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)]" style={inset}>{t("faculty.bulkAdd")}</button>
        </div>
      </section>

      {/* ── Departments ── */}
      <section className="rounded-2xl p-5" style={cardStyle}>
        <div className="mb-3 flex items-center gap-2"><Building2 className="size-4 text-[var(--color-text-secondary)]" /><h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{t("faculty.departmentsTitle")}</h2></div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {config.departments.map((d) => (
            <span key={d.id} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-[var(--color-text-secondary)]" style={inset}>
              {d.label}
              <button type="button" disabled={busy} onClick={() => post({ action: "removeDept", id: d.id })} aria-label={t("faculty.removeDept")} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-status-error)]"><X className="size-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={deptLabel} onChange={(e) => setDeptLabel(e.target.value)} placeholder={t("faculty.deptPlaceholder")} className="flex-1 rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none" style={inset} />
          <button type="button" disabled={busy || !deptLabel.trim()} onClick={() => post({ action: "upsertDept", label: deptLabel.trim() }).then((ok) => { if (ok) setDeptLabel(""); })} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)]" style={inset}><Plus className="size-3.5" />{t("faculty.addDept")}</button>
        </div>
      </section>

      {/* ── Faculty list ── */}
      <section>
        <div className="mb-3 flex items-center gap-2"><Users className="size-4 text-[var(--color-text-secondary)]" /><h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{t("faculty.listTitle")} ({config.faculty.length})</h2></div>
        <div className="space-y-2">
          {config.faculty.map((f) => {
            const unassignedDepts = config.departments.filter((d) => !f.departments.includes(d.id));
            return (
              <div key={f.email} className="rounded-xl p-3.5" style={cardStyle}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ background: STATUS_COLOR[f.status] }} />
                      <span className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{f.name}</span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-[var(--color-text-tertiary)]">{f.email}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <a href={`/api/admin/faculty/${encodeURIComponent(f.email)}/profile`} className="rounded-lg p-1.5 text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-primary)]" style={inset} aria-label={t("faculty.downloadProfile")} title={t("faculty.downloadProfile")}>
                      <Download className="size-3.5" />
                    </a>
                    <select value={f.status} disabled={busy} onChange={(e) => post({ action: "setStatus", email: f.email, status: e.target.value })} className="rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] outline-none" style={inset}>
                      <option value="active">{t("faculty.statusActive")}</option>
                      <option value="llp">{t("faculty.statusLlp")}</option>
                      <option value="inactive">{t("faculty.statusInactive")}</option>
                    </select>
                  </div>
                </div>
                {/* Departments */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {f.departments.length === 0 && <span className="text-[11px] text-[var(--color-text-tertiary)]">{t("faculty.unassigned")}</span>}
                  {f.departments.map((id) => (
                    <span key={id} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-[var(--color-text-secondary)]" style={inset}>
                      {deptLabelById(id)}
                      <button type="button" disabled={busy} onClick={() => post({ action: "setDepartments", email: f.email, departmentIds: f.departments.filter((x) => x !== id) })} aria-label={t("common.remove")} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-status-error)]"><X className="size-3" /></button>
                    </span>
                  ))}
                  {unassignedDepts.length > 0 && (
                    <select value="" disabled={busy} onChange={(e) => { if (e.target.value) post({ action: "setDepartments", email: f.email, departmentIds: [...f.departments, e.target.value] }); }} className="rounded-md px-1.5 py-0.5 text-[11px] text-[var(--color-text-secondary)] outline-none" style={inset}>
                      <option value="">+ {t("faculty.assignDept")}</option>
                      {unassignedDepts.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                    </select>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
