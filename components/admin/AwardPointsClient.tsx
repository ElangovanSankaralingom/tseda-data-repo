"use client";
import { notifyDataChanged } from "@/lib/ui/appRefresh";

import { useState } from "react";
import { Loader2, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useTranslation } from "@/lib/i18n/useTranslation";
import {
  AWARD_SECTIONS,
  type AwardMetricDefinition,
  type AwardPointsModel,
  type AwardSectionId,
} from "@/data/awardMetrics";

type EffectiveMetric = AwardMetricDefinition & {
  effectiveModel: AwardPointsModel;
  overridden: boolean;
};

type PointsResponse = { data?: { metrics: EffectiveMetric[] } };

/**
 * Admin points editor (roadmap #14) — the rulebook's document defaults vs
 * the live values, per metric, inline-editable. Overrides land in
 * points-config.json and every score (and appraisal document) resolves
 * through them instantly — the registry itself is never mutated.
 */
export default function AwardPointsClient() {
  const { t } = useTranslation();
  const { data: body, mutate } = useApi<PointsResponse>("/api/admin/awards/points");
  const metrics = body?.data?.metrics ?? [];

  if (metrics.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border-default)] p-10">
        <Loader2 className="size-5 animate-spin text-[var(--color-icon-muted)]" />
      </div>
    );
  }

  const sectionIds = (Object.keys(AWARD_SECTIONS) as AwardSectionId[]).sort(
    (a, b) => AWARD_SECTIONS[a].order - AWARD_SECTIONS[b].order,
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--color-text-tertiary)]">
        <SlidersHorizontal className="mr-1.5 inline size-3.5 align-[-2px]" />
        {t("awardsAdmin.pointsConfigNote")}
      </p>
      {sectionIds.map((sectionId) => {
        const own = metrics.filter((m) => m.section === sectionId);
        if (own.length === 0) return null;
        return (
          <section
            key={sectionId}
            className="overflow-hidden rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-panel)]"
          >
            <header className="border-b border-[var(--color-divider)] bg-[var(--color-surface-panel-raised)] px-4 py-3">
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                {AWARD_SECTIONS[sectionId].label}
              </h3>
            </header>
            <ul className="divide-y divide-[var(--color-divider)]">
              {own.map((metric) => (
                <PointsRow
                  key={`${metric.id}:${JSON.stringify(metric.effectiveModel)}`}
                  metric={metric}
                  onSaved={async () => {
                    await mutate();
                    notifyDataChanged();
                  }}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function modelPoints(model: AwardPointsModel): string {
  if (model.kind === "tiered") return "";
  return String(model.points);
}

function PointsRow({
  metric,
  onSaved,
}: {
  metric: EffectiveMetric;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [points, setPoints] = useState<string>(modelPoints(metric.effectiveModel));
  const [tiers, setTiers] = useState<Record<string, string>>(
    metric.effectiveModel.kind === "tiered"
      ? Object.fromEntries(metric.effectiveModel.tiers.map((tier) => [tier.key, String(tier.points)]))
      : {},
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTiered = metric.effectiveModel.kind === "tiered";
  const defaults = metric.pointsModel;

  const dirty = isTiered
    ? defaults.kind === "tiered" &&
      metric.effectiveModel.kind === "tiered" &&
      metric.effectiveModel.tiers.some((tier) => tiers[tier.key] !== String(tier.points))
    : points !== modelPoints(metric.effectiveModel);

  const valid = isTiered
    ? Object.values(tiers).every((v) => v.trim() !== "" && Number.isFinite(Number(v)) && Number(v) >= 0)
    : points.trim() !== "" && Number.isFinite(Number(points)) && Number(points) >= 0;

  async function put(payload: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/awards/points", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metricId: metric.id, ...payload }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? t("common.error"));
        return;
      }
      await onSaved();
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-20 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-inset)] px-2.5 py-1.5 text-xs font-bold text-[var(--color-text-primary)] outline-none focus:border-[var(--color-border-strong)]";

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-xs font-medium text-[var(--color-text-primary)]" title={metric.details}>
              {metric.label}
            </span>
            {metric.overridden ? (
              <span className="shrink-0 rounded-md border border-[var(--color-status-warning-border)] bg-[var(--color-status-warning-bg)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-status-warning)]">
                {t("awardsAdmin.overriddenBadge")}
              </span>
            ) : null}
          </div>
          {!isTiered ? (
            <div className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
              {t("awardsAdmin.defaultLabel")}: {defaults.kind !== "tiered" ? defaults.points : ""}
              {metric.effectiveModel.kind === "perUnit" ? ` · ${t("awardsAdmin.perUnit")}` : ""}
              {metric.effectiveModel.kind !== "tiered" && metric.effectiveModel.maxPoints
                ? ` · ${t("awardsAdmin.maxHint").replace("{n}", String(metric.effectiveModel.maxPoints))}`
                : ""}
            </div>
          ) : null}
        </div>

        {!isTiered ? (
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.5}
            value={points || ""}
            onChange={(e) => setPoints(e.target.value)}
            disabled={busy}
            aria-label={metric.label}
            className={inputClass}
          />
        ) : null}

        <SaveResetButtons
          busy={busy}
          dirty={dirty}
          valid={valid}
          overridden={metric.overridden}
          onSave={() =>
            void put(
              isTiered
                ? { tiers: Object.fromEntries(Object.entries(tiers).map(([k, v]) => [k, Number(v)])) }
                : { points: Number(points) },
            )
          }
          onReset={() => void put({ reset: true })}
        />
      </div>

      {isTiered && metric.effectiveModel.kind === "tiered" && defaults.kind === "tiered" ? (
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {metric.effectiveModel.tiers.map((tier) => {
            const defaultTier = defaults.tiers.find((d) => d.key === tier.key);
            return (
              <div
                key={tier.key}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-panel-raised)] px-2.5 py-1.5"
              >
                <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--color-text-secondary)]" title={tier.label}>
                  {tier.label}
                  <span className="ml-1.5 text-[var(--color-text-muted)]">
                    ({t("awardsAdmin.defaultLabel")}: {defaultTier?.points ?? 0})
                  </span>
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.5}
                  value={tiers[tier.key] || ""}
                  onChange={(e) => setTiers((c) => ({ ...c, [tier.key]: e.target.value }))}
                  disabled={busy}
                  aria-label={`${metric.label} — ${tier.label}`}
                  className={inputClass}
                />
              </div>
            );
          })}
        </div>
      ) : null}

      {error ? <p className="mt-1.5 text-[11px] text-[var(--color-status-error)]">{error}</p> : null}
    </li>
  );
}

function SaveResetButtons({
  busy,
  dirty,
  valid,
  overridden,
  onSave,
  onReset,
}: {
  busy: boolean;
  dirty: boolean;
  valid: boolean;
  overridden: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={onSave}
        disabled={busy || !dirty || !valid}
        className="flex items-center gap-1.5 rounded-lg bg-[var(--color-button-primary-bg)] px-3 py-1.5 text-xs font-bold text-[var(--color-button-primary-text)] transition-opacity disabled:opacity-40"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
        {t("awardsAdmin.saveAward")}
      </button>
      {overridden ? (
        <button
          type="button"
          onClick={onReset}
          disabled={busy}
          title={t("awardsAdmin.resetToDefault")}
          className="flex items-center gap-1 rounded-lg border border-[var(--color-border-default)] px-2.5 py-1.5 text-xs font-bold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-raised)] disabled:opacity-40"
        >
          <RotateCcw className="size-3.5" />
          {t("awardsAdmin.resetToDefault")}
        </button>
      ) : null}
    </div>
  );
}
