"use client";

import { useCallback, useMemo, useState } from "react";
import { Columns, Plus, Trash2, ArrowUp, ArrowDown, X, Check } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

type Field = { key: string; label: string };
type Category = { key: string; fields: Field[] };
type Template = {
  id: string;
  label: string;
  category: string;
  columns: string[];
  createdBy: string;
  ownerScope: "master" | "dlc";
};

const cardStyle = {
  background: "var(--color-card-bg)",
  border: "1px solid var(--color-border-default)",
} as const;

export default function FormatsClient({
  initialTemplates,
  categories,
}: {
  initialTemplates: Template[];
  categories: Category[];
}) {
  const { t, categoryLabel } = useTranslation();
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Editor state
  const [editId, setEditId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState(categories[0]?.key ?? "");
  const [selected, setSelected] = useState<string[]>([]);

  const fieldsByKey = useMemo(() => {
    const m = new Map<string, Map<string, string>>();
    categories.forEach((c) => m.set(c.key, new Map(c.fields.map((f) => [f.key, f.label]))));
    return m;
  }, [categories]);

  const catFields = categories.find((c) => c.key === category)?.fields ?? [];
  const available = catFields.filter((f) => !selected.includes(f.key));

  const resetForm = useCallback(() => {
    setEditId(null);
    setLabel("");
    setCategory(categories[0]?.key ?? "");
    setSelected([]);
  }, [categories]);

  const post = useCallback(async (body: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/export/formats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { templates?: Template[]; error?: string };
      if (!res.ok) {
        setError(data.error || t("common.error"));
        return false;
      }
      if (data.templates) setTemplates(data.templates);
      return true;
    } catch {
      setError(t("common.error"));
      return false;
    } finally {
      setBusy(false);
    }
  }, [t]);

  const save = useCallback(async () => {
    if (!label.trim() || !category || selected.length === 0) {
      setError(t("formats.needAll"));
      return;
    }
    const ok = await post({
      action: "upsert",
      template: { id: editId ?? undefined, label: label.trim(), category, columns: selected },
    });
    if (ok) resetForm();
  }, [label, category, selected, editId, post, resetForm, t]);

  const startEdit = (tpl: Template) => {
    setEditId(tpl.id);
    setLabel(tpl.label);
    setCategory(tpl.category);
    setSelected(tpl.columns);
    setError(null);
  };

  const move = (i: number, dir: -1 | 1) => {
    setSelected((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "var(--color-status-error-bg)", border: "1px solid var(--color-status-error-border)", color: "var(--color-status-error)" }}>
          {error}
        </div>
      )}

      {categories.length === 0 ? (
        <div className="rounded-2xl px-5 py-8 text-center text-sm text-[var(--color-text-tertiary)]" style={{ background: "var(--color-surface-inset)", border: "1px dashed var(--color-border-default)" }}>
          {t("formats.noCategories")}
        </div>
      ) : (
        /* ── Editor ── */
        <section className="rounded-2xl p-5" style={cardStyle}>
          <div className="mb-4 flex items-center gap-2">
            <Columns className="size-4 text-[var(--color-text-secondary)]" />
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {editId ? t("formats.editTitle") : t("formats.createTitle")}
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">{t("formats.nameLabel")}</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t("formats.namePlaceholder")}
                className="w-full rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none"
                style={{ background: "var(--color-surface-inset)", border: "1px solid var(--color-border-default)" }}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">{t("formats.categoryLabel")}</label>
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setSelected([]); }}
                disabled={!!editId}
                className="w-full rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none disabled:opacity-60"
                style={{ background: "var(--color-surface-inset)", border: "1px solid var(--color-border-default)" }}
              >
                {categories.map((c) => (
                  <option key={c.key} value={c.key}>{categoryLabel(c.key)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {/* Available */}
            <div className="rounded-xl p-3" style={{ background: "var(--color-surface-inset)", border: "1px solid var(--color-border-subtle)" }}>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">{t("formats.available")}</div>
              <div className="flex flex-wrap gap-1.5">
                {available.length === 0 ? (
                  <span className="text-xs text-[var(--color-text-tertiary)]">—</span>
                ) : available.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setSelected((p) => [...p, f.key])}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
                    style={{ background: "var(--color-card-bg)", border: "1px solid var(--color-border-default)" }}
                  >
                    <Plus className="size-3" />{f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected, ordered */}
            <div className="rounded-xl p-3" style={{ background: "var(--color-surface-inset)", border: "1px solid var(--color-border-subtle)" }}>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">{t("formats.selected")}</div>
              {selected.length === 0 ? (
                <p className="text-xs text-[var(--color-text-tertiary)]">{t("formats.selectHint")}</p>
              ) : (
                <ol className="space-y-1.5">
                  {selected.map((key, i) => (
                    <li key={key} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5" style={{ background: "var(--color-card-bg)", border: "1px solid var(--color-border-default)" }}>
                      <span className="truncate text-xs text-[var(--color-text-primary)]">
                        <span className="mr-1.5 font-mono text-[10px] text-[var(--color-text-tertiary)]">{i + 1}</span>
                        {fieldsByKey.get(category)?.get(key) ?? key}
                      </span>
                      <span className="flex shrink-0 items-center gap-0.5">
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] disabled:opacity-30" aria-label={t("formats.moveUp")}><ArrowUp className="size-3.5" /></button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === selected.length - 1} className="rounded p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] disabled:opacity-30" aria-label={t("formats.moveDown")}><ArrowDown className="size-3.5" /></button>
                        <button type="button" onClick={() => setSelected((p) => p.filter((k) => k !== key))} className="rounded p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-status-error)]" aria-label={t("common.remove")}><X className="size-3.5" /></button>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button type="button" onClick={save} disabled={busy} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-[var(--color-button-primary-text)] disabled:opacity-60" style={{ background: "var(--color-button-primary-bg)" }}>
              <Check className="size-4" />{editId ? t("common.save") : t("formats.create")}
            </button>
            {editId && (
              <button type="button" onClick={resetForm} className="rounded-lg px-3 py-2 text-sm text-[var(--color-text-secondary)]" style={{ background: "var(--color-surface-inset)", border: "1px solid var(--color-border-default)" }}>
                {t("common.cancel")}
              </button>
            )}
          </div>
        </section>
      )}

      {/* ── Existing ── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">{t("formats.existingTitle")}</h2>
        {templates.length === 0 ? (
          <div className="rounded-2xl px-5 py-8 text-center text-sm text-[var(--color-text-tertiary)]" style={{ background: "var(--color-surface-inset)", border: "1px dashed var(--color-border-default)" }}>
            {t("formats.empty")}
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((tpl) => (
              <div key={tpl.id} className="flex items-center justify-between gap-3 rounded-2xl p-4" style={cardStyle}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{tpl.label}</span>
                    <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]" style={{ background: "var(--color-surface-inset)", border: "1px solid var(--color-border-subtle)" }}>{categoryLabel(tpl.category)}</span>
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "var(--color-badge-bg)", color: "var(--color-badge-text)" }}>{tpl.ownerScope === "master" ? t("formats.masterBadge") : t("formats.dlcBadge")}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">{tpl.columns.length} {t("formats.columns")}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button type="button" onClick={() => startEdit(tpl)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]" style={{ background: "var(--color-surface-inset)", border: "1px solid var(--color-border-default)" }}>{t("common.edit")}</button>
                  {confirmDelete === tpl.id ? (
                    <>
                      <button type="button" onClick={() => post({ action: "remove", id: tpl.id }).then(() => setConfirmDelete(null))} disabled={busy} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold" style={{ background: "var(--color-status-error-bg)", border: "1px solid var(--color-status-error-border)", color: "var(--color-status-error)" }}>{t("formats.delete")}</button>
                      <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-lg p-1.5 text-[var(--color-text-tertiary)]" aria-label={t("common.cancel")}><X className="size-4" /></button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setConfirmDelete(tpl.id)} className="rounded-lg p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-status-error)]" aria-label={t("formats.delete")}><Trash2 className="size-4" /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
