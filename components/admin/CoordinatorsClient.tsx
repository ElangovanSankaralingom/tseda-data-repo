"use client";
import { notifyDataChanged } from "@/lib/ui/appRefresh";

import { useCallback, useMemo, useState } from "react";
import { Network, Plus, Trash2, X, ShieldCheck, Download, ClipboardPen } from "lucide-react";
import { CATEGORY_LIST } from "@/data/categoryRegistry";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { adminCoordinators } from "@/lib/entryNavigation";
import type { CoordinatorsConfig, CoordinatorType } from "@/lib/admin/coordinators";

type Faculty = { email: string; name: string };
type MasterTemplate = { id: string; label: string; category: string };

type Action =
  | { action: "upsertType"; type: Partial<CoordinatorType> }
  | { action: "removeType"; id: string }
  | { action: "assign"; email: string; typeId: string }
  | { action: "unassign"; email: string; typeId: string };

const cardStyle = {
  background: "var(--color-card-bg)",
  border: "1px solid var(--color-border-default)",
} as const;

export default function CoordinatorsClient({
  initialConfig,
  faculty,
  masterTemplates = [],
}: {
  initialConfig: CoordinatorsConfig;
  faculty: Faculty[];
  masterTemplates?: MasterTemplate[];
}) {
  const { t, categoryLabel } = useTranslation();
  const [config, setConfig] = useState<CoordinatorsConfig>(initialConfig);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create-form state
  const [label, setLabel] = useState("");
  const [cats, setCats] = useState<Set<string>>(new Set());
  const [approveEdits, setApproveEdits] = useState(true);
  const [approveDeletes, setApproveDeletes] = useState(false);
  const [exportPower, setExportPower] = useState(false);
  const [enterData, setEnterData] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const nameByEmail = useMemo(() => {
    const m = new Map<string, string>();
    faculty.forEach((f) => m.set(f.email, f.name));
    return m;
  }, [faculty]);

  const templateById = useMemo(() => {
    const m = new Map<string, MasterTemplate>();
    masterTemplates.forEach((tpl) => m.set(tpl.id, tpl));
    return m;
  }, [masterTemplates]);

  const post = useCallback(async (body: Action) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(adminCoordinators().replace("/admin/", "/api/admin/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as CoordinatorsConfig & { error?: string };
      if (!res.ok) {
        setError(data.error || t("common.error"));
        return false;
      }
      setConfig(data);
      notifyDataChanged();
      return true;
    } catch {
      setError(t("common.error"));
      return false;
    } finally {
      setBusy(false);
    }
  }, [t]);

  const createType = useCallback(async () => {
    if (!label.trim() || cats.size === 0) {
      setError(t("coordinators.needNameCategory"));
      return;
    }
    const ok = await post({
      action: "upsertType",
      type: {
        label: label.trim(),
        categories: Array.from(cats) as CoordinatorType["categories"],
        powers: { approveEdits, approveDeletes, export: exportPower, enterData },
      },
    });
    if (ok) {
      setLabel("");
      setCats(new Set());
      setApproveEdits(true);
      setApproveDeletes(false);
      setExportPower(false);
      setEnterData(false);
    }
  }, [label, cats, approveEdits, approveDeletes, exportPower, enterData, post, t]);

  const toggleCat = (key: string) => {
    setCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const assigneesForType = (typeId: string) =>
    config.assignments.filter((a) => a.typeIds.includes(typeId)).map((a) => a.email);

  const setTypeTemplates = (type: CoordinatorType, exportTemplateIds: string[]) =>
    post({ action: "upsertType", type: { ...type, exportTemplateIds } });

  return (
    <div className="space-y-6">
      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{
            background: "var(--color-status-error-bg)",
            border: "1px solid var(--color-status-error-border)",
            color: "var(--color-status-error)",
          }}
        >
          {error}
        </div>
      )}

      {/* ── Create coordinator type ── */}
      <section className="rounded-2xl p-5" style={cardStyle}>
        <div className="mb-4 flex items-center gap-2">
          <Plus className="size-4 text-[var(--color-text-secondary)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("coordinators.createTitle")}
          </h2>
        </div>

        <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
          {t("coordinators.nameLabel")}
        </label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("coordinators.namePlaceholder")}
          className="mb-4 w-full rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none"
          style={{ background: "var(--color-surface-inset)", border: "1px solid var(--color-border-default)" }}
        />

        <div className="mb-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
          {t("coordinators.categoriesLabel")}
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {CATEGORY_LIST.map((key) => {
            const on = cats.has(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleCat(key)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                style={
                  on
                    ? { background: "var(--color-primary-muted)", border: "1.5px solid var(--color-primary)", color: "var(--color-text-primary)" }
                    : { background: "var(--color-surface-inset)", border: "1px solid var(--color-border-default)", color: "var(--color-text-secondary)" }
                }
              >
                {categoryLabel(key)}
              </button>
            );
          })}
        </div>

        <div className="mb-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
          {t("coordinators.powersLabel")}
        </div>
        <div className="mb-5 flex flex-wrap gap-2">
          <PowerToggle on={approveEdits} onClick={() => setApproveEdits((v) => !v)} icon={ShieldCheck} label={t("coordinators.powerApproveEdits")} />
          <PowerToggle on={approveDeletes} onClick={() => setApproveDeletes((v) => !v)} icon={Trash2} label={t("coordinators.powerApproveDeletes")} />
          <PowerToggle on={exportPower} onClick={() => setExportPower((v) => !v)} icon={Download} label={t("coordinators.powerExport")} />
          <PowerToggle on={enterData} onClick={() => setEnterData((v) => !v)} icon={ClipboardPen} label={t("coordinators.powerEnterData")} />
        </div>

        <button
          type="button"
          onClick={createType}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-[var(--color-button-primary-text)] transition-opacity disabled:opacity-60"
          style={{ background: "var(--color-button-primary-bg)" }}
        >
          <Plus className="size-4" />
          {t("coordinators.create")}
        </button>
      </section>

      {/* ── Existing types ── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
          {t("coordinators.existingTitle")}
        </h2>

        {config.types.length === 0 ? (
          <div
            className="rounded-2xl px-5 py-8 text-center text-sm text-[var(--color-text-tertiary)]"
            style={{ background: "var(--color-surface-inset)", border: "1px dashed var(--color-border-default)" }}
          >
            {t("coordinators.empty")}
          </div>
        ) : (
          <div className="space-y-4">
            {config.types.map((type) => {
              const assignees = assigneesForType(type.id);
              const unassigned = faculty.filter((f) => !assignees.includes(f.email));
              return (
                <div key={type.id} className="rounded-2xl p-5" style={cardStyle}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-9 items-center justify-center rounded-xl" style={{ background: "var(--color-palette-cyan-bg)" }}>
                        <Network className="size-4 text-[var(--color-palette-cyan-fg)]" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[var(--color-text-primary)]">{type.label}</div>
                        <div className="mt-0.5 flex flex-wrap gap-1.5">
                          {type.powers.approveEdits && <Badge label={t("coordinators.powerApproveEdits")} />}
                          {type.powers.approveDeletes && <Badge label={t("coordinators.powerApproveDeletes")} />}
                          {type.powers.export && <Badge label={t("coordinators.powerExport")} />}
                          {type.powers.enterData && <Badge label={t("coordinators.powerEnterData")} />}
                        </div>
                      </div>
                    </div>

                    {confirmDelete === type.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => post({ action: "removeType", id: type.id }).then(() => setConfirmDelete(null))}
                          disabled={busy}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                          style={{ background: "var(--color-status-error-bg)", border: "1px solid var(--color-status-error-border)", color: "var(--color-status-error)" }}
                        >
                          {t("coordinators.delete")}
                        </button>
                        <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-lg p-1.5 text-[var(--color-text-tertiary)]" aria-label={t("common.cancel")}>
                          <X className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(type.id)}
                        className="rounded-lg p-2 text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-status-error)]"
                        aria-label={t("coordinators.delete")}
                        title={t("coordinators.deleteConfirm")}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>

                  {/* Categories */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {type.categories.map((c) => (
                      <span
                        key={c}
                        className="rounded-md px-2 py-1 text-[11px] font-medium text-[var(--color-text-secondary)]"
                        style={{ background: "var(--color-surface-inset)", border: "1px solid var(--color-border-subtle)" }}
                      >
                        {categoryLabel(c)}
                      </span>
                    ))}
                  </div>

                  {/* Assigned export formats (only meaningful with the export power) */}
                  {type.powers.export && (
                    <div className="mt-3 rounded-xl p-3" style={{ background: "var(--color-surface-inset)", border: "1px solid var(--color-border-subtle)" }}>
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                        {t("coordinators.assignedFormats")}
                      </div>
                      {type.exportTemplateIds.length === 0 ? (
                        <div className="mb-2 text-xs text-[var(--color-text-tertiary)]">{t("coordinators.noFormats")}</div>
                      ) : (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {type.exportTemplateIds.map((id) => (
                            <span key={id} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-[var(--color-text-secondary)]" style={{ background: "var(--color-card-bg)", border: "1px solid var(--color-border-default)" }}>
                              {templateById.get(id)?.label ?? id}
                              <button
                                type="button"
                                onClick={() => setTypeTemplates(type, type.exportTemplateIds.filter((x) => x !== id))}
                                disabled={busy}
                                aria-label={t("common.remove")}
                                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-status-error)]"
                              >
                                <X className="size-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <AssignPicker
                        options={masterTemplates
                          .filter((mt) => (type.categories as string[]).includes(mt.category) && !type.exportTemplateIds.includes(mt.id))
                          .map((mt) => ({ email: mt.id, name: mt.label }))}
                        disabled={busy}
                        placeholder={t("coordinators.addFormat")}
                        addLabel={t("coordinators.add")}
                        onAdd={(id) => setTypeTemplates(type, [...type.exportTemplateIds, id])}
                      />
                    </div>
                  )}

                  {/* Assignees */}
                  <div className="mt-4 rounded-xl p-3" style={{ background: "var(--color-surface-inset)", border: "1px solid var(--color-border-subtle)" }}>
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                      {t("coordinators.assignees")}
                    </div>
                    {assignees.length === 0 ? (
                      <div className="mb-2 text-xs text-[var(--color-text-tertiary)]">{t("coordinators.noAssignees")}</div>
                    ) : (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {assignees.map((em) => (
                          <span key={em} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-[var(--color-text-secondary)]" style={{ background: "var(--color-card-bg)", border: "1px solid var(--color-border-default)" }}>
                            {nameByEmail.get(em) || em}
                            <button
                              type="button"
                              onClick={() => post({ action: "unassign", email: em, typeId: type.id })}
                              disabled={busy}
                              aria-label={t("common.remove")}
                              className="text-[var(--color-text-tertiary)] hover:text-[var(--color-status-error)]"
                            >
                              <X className="size-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <AssignPicker
                      options={unassigned}
                      disabled={busy}
                      placeholder={t("coordinators.assignPlaceholder")}
                      addLabel={t("coordinators.add")}
                      onAdd={(email) => post({ action: "assign", email, typeId: type.id })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
      style={{ background: "var(--color-badge-bg)", color: "var(--color-badge-text)" }}
    >
      {label}
    </span>
  );
}

function PowerToggle({
  on,
  onClick,
  icon: Icon,
  label,
}: {
  on: boolean;
  onClick: () => void;
  icon: typeof ShieldCheck;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors"
      style={
        on
          ? { background: "var(--color-primary-muted)", border: "1.5px solid var(--color-primary)", color: "var(--color-text-primary)" }
          : { background: "var(--color-surface-inset)", border: "1px solid var(--color-border-default)", color: "var(--color-text-secondary)" }
      }
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

function AssignPicker({
  options,
  disabled,
  placeholder,
  addLabel,
  onAdd,
}: {
  options: Faculty[];
  disabled: boolean;
  placeholder: string;
  addLabel: string;
  onAdd: (email: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="flex gap-2">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled || options.length === 0}
        className="flex-1 rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] outline-none"
        style={{ background: "var(--color-card-bg)", border: "1px solid var(--color-border-default)" }}
      >
        <option value="">{placeholder}</option>
        {options.map((f) => (
          <option key={f.email} value={f.email}>
            {f.name} ({f.email})
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          if (value) {
            onAdd(value);
            setValue("");
          }
        }}
        disabled={disabled || !value}
        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] transition-colors disabled:opacity-50"
        style={{ background: "var(--color-surface-inset)", border: "1px solid var(--color-border-default)" }}
      >
        {addLabel}
      </button>
    </div>
  );
}
