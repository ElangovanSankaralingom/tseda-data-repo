"use client";

import { useEffect, useMemo, useState } from "react";
import { FlaskConical, LogOut, Plus, X, UserCheck } from "lucide-react";
import SelectDropdown from "@/components/controls/SelectDropdown";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { formatDate } from "@/lib/i18n/locale";

type FacultyOption = { fullName: string; email: string };
type ActiveSession = { email: string; activatedAt: string };

type RosterState = {
  roster: string[];
  active: ActiveSession[];
};

/**
 * Demo-mode administration (master admin only): toggle your own session and
 * manage the roster of faculty allowed to use demo mode. Removing an active
 * participant exits them server-side and wipes their demo data.
 */
export default function DemoModeClient({
  initialRoster,
  initialActive,
  selfActive,
}: {
  initialRoster: string[];
  initialActive: ActiveSession[];
  selfActive: boolean;
}) {
  const { t, language } = useTranslation();
  const [state, setState] = useState<RosterState>({
    roster: initialRoster,
    active: initialActive,
  });
  const [faculty, setFaculty] = useState<FacultyOption[]>([]);
  const [pendingAdd, setPendingAdd] = useState("");
  const [saving, setSaving] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/faculty", { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as FacultyOption[]) : []))
      .then((list) => {
        if (!cancelled && Array.isArray(list)) setFaculty(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const nameOf = useMemo(() => {
    const map = new Map(faculty.map((f) => [f.email.toLowerCase(), f.fullName]));
    return (email: string) => map.get(email.toLowerCase()) ?? email;
  }, [faculty]);

  const activeEmails = useMemo(
    () => new Set(state.active.map((a) => a.email.toLowerCase())),
    [state.active],
  );

  const addOptions = useMemo(
    () =>
      faculty
        .filter((f) => !state.roster.includes(f.email.toLowerCase()))
        .map((f) => ({ label: `${f.fullName} — ${f.email}`, value: f.email })),
    [faculty, state.roster],
  );

  async function saveRoster(nextRoster: string[]) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/demo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roster: nextRoster }),
      });
      const body = (await res.json()) as { data?: RosterState; error?: { message?: string } };
      if (res.ok && body.data) {
        setState(body.data);
        setPendingAdd("");
      } else {
        setError(body.error?.message ?? t("common.error"));
      }
    } catch {
      setError(t("common.error"));
    }
    setSaving(false);
  }

  async function toggleSelf() {
    if (toggleBusy) return;
    setToggleBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: selfActive ? "exit" : "enter" }),
      });
      if (res.ok) {
        window.location.href = "/dashboard";
        return;
      }
      setError(selfActive ? t("demo.exitFailed") : t("demo.enterFailed"));
    } catch {
      setError(selfActive ? t("demo.exitFailed") : t("demo.enterFailed"));
    }
    setToggleBusy(false);
  }

  return (
    <div className="space-y-6">
      {/* ── Your session ── */}
      <section
        className="rounded-2xl border p-5"
        style={{
          borderColor: "var(--color-status-warning-border)",
          background: "var(--color-surface-panel)",
        }}
      >
        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          {t("demo.yourSession")}
        </h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className="flex size-9 items-center justify-center rounded-xl"
              style={{ background: "var(--color-status-warning-bg)" }}
            >
              <FlaskConical className="size-4.5" style={{ color: "var(--color-status-warning)" }} />
            </span>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {selfActive ? t("demo.youAreIn") : t("demo.youAreOut")}
            </span>
          </div>
          <button
            type="button"
            disabled={toggleBusy}
            onClick={() => void toggleSelf()}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-transform duration-150 hover:scale-[1.02] active:scale-95 disabled:opacity-60"
            style={{
              background: "var(--color-status-warning)",
              color: "var(--color-text-on-accent)",
            }}
          >
            {selfActive ? <LogOut className="size-4" /> : <FlaskConical className="size-4" />}
            {toggleBusy
              ? selfActive
                ? t("demo.exiting")
                : t("demo.entering")
              : selfActive
                ? t("demo.exit")
                : t("demo.enter")}
          </button>
        </div>
      </section>

      {/* ── Assigned faculty ── */}
      <section
        className="rounded-2xl border border-[var(--color-border-default)] p-5"
        style={{ background: "var(--color-surface-panel)" }}
      >
        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          {t("demo.assignTitle")}
        </h2>
        <p className="mt-1.5 text-xs text-[var(--color-text-secondary)]">{t("demo.assignDesc")}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="w-full max-w-md">
            <SelectDropdown
              value={pendingAdd}
              onChange={(value) => setPendingAdd(value)}
              options={addOptions}
              placeholder={t("demo.addFaculty")}
            />
          </div>
          <button
            type="button"
            disabled={!pendingAdd || saving}
            onClick={() => void saveRoster([...state.roster, pendingAdd.toLowerCase()])}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--color-border-strong)] px-3.5 py-2 text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-raised)] disabled:opacity-50"
          >
            <Plus className="size-4" />
            {t("demo.addFaculty")}
          </button>
        </div>

        {state.roster.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-text-muted)]">{t("demo.noneAssigned")}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {state.roster.map((email) => {
              const session = state.active.find((a) => a.email.toLowerCase() === email);
              return (
                <li
                  key={email}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border-subtle)] px-3.5 py-2.5"
                  style={{ background: "var(--color-surface-panel-raised)" }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                        {nameOf(email)}
                      </span>
                      {activeEmails.has(email) && (
                        <span
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                          style={{
                            background: "var(--color-status-warning-bg)",
                            color: "var(--color-status-warning)",
                            border: "1px solid var(--color-status-warning-border)",
                          }}
                        >
                          <UserCheck className="size-2.5" />
                          {t("demo.activeNow")}
                        </span>
                      )}
                    </div>
                    <span className="block truncate font-mono text-[11px] text-[var(--color-text-tertiary)]">
                      {email}
                      {session
                        ? ` · ${t("demo.since").replace("{time}", formatDate(session.activatedAt, language))}`
                        : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveRoster(state.roster.filter((e) => e !== email))}
                    aria-label={`${t("demo.remove")} ${email}`}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--color-status-error)] transition-colors hover:bg-[var(--color-status-error-bg)] disabled:opacity-50"
                  >
                    <X className="size-3.5" />
                    {t("demo.remove")}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {error && (
          <p className="mt-3 text-xs font-medium text-[var(--color-status-error)]" role="alert">
            {error}
          </p>
        )}
        <p className="mt-4 text-[11px] text-[var(--color-text-tertiary)]">{t("demo.autoWipeNote")}</p>
      </section>
    </div>
  );
}
