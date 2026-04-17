"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ProfileHeader from "@/components/account/ProfileHeader";
import ProfileTab from "@/components/account/ProfileTab";
import PersonalTab from "@/components/account/PersonalTab";
import AcademicTab from "@/components/account/AcademicTab";
import ExperienceTab from "@/components/account/ExperienceTab";
import UploadsTab from "@/components/account/UploadsTab";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { dashboard } from "@/lib/entryNavigation";
import {
  cx,
  buildErrors,
  buildPatchForTab,
  getErrorsForTab,
  getTabForErrorKey,
  getTabSnapshot,
  applySavedTabToDraft,
  normalizeProfileState,
  stableStringify,
  createTabState,
  getErrorMessage,
  TAB_KEYS,
  type TabKey,
  type Profile,
  type SaveTabOptions,
} from "@/components/account/types";

export default function AccountPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState("");

  const saveLockRef = useRef(false);

  const [profile, setProfile] = useState<Profile>({
    email: "",
    personal: {},
    academic: {},
    experience: { lopPeriods: [], academicOutsideTCE: [], industry: [] },
    uploads: { appointmentLetter: null, joiningLetter: null, aadhar: null, panCard: null },
  });

  const [draft, setDraft] = useState<Profile>(profile);
  const [saveAttemptedTabs, setSaveAttemptedTabs] = useState<Record<TabKey, boolean>>(createTabState());

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const r = await fetch("/api/me", { cache: "no-store" });
        const p = normalizeProfileState((await r.json()) as Profile);
        setProfile(p);
        setDraft(p);
      } catch {
        setToast({ type: "err", msg: "Failed to load profile." });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const errors = useMemo(() => buildErrors(draft), [draft]);

  function shouldShowError(key: string) {
    const tab = getTabForErrorKey(key);
    return tab ? (saveAttemptedTabs[tab] || dirtyByTab[tab]) : false;
  }

  const dirtyByTab = useMemo(
    () =>
      TAB_KEYS.reduce(
        (acc, tab) => ({
          ...acc,
          [tab]: stableStringify(getTabSnapshot(profile, tab)) !== stableStringify(getTabSnapshot(draft, tab)),
        }),
        createTabState()
      ),
    [profile, draft]
  );

  const activeTabDirty = dirtyByTab[activeTab];
  const activeTabErrors = getErrorsForTab(activeTab, errors);
  const hasBlockingErrors = activeTabErrors.length > 0;
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  async function saveCurrentTab(options: SaveTabOptions) {
    if (saveLockRef.current) return;
    saveLockRef.current = true;

    try {
      const { tab, draftOverride } = options;
      const draftToSave = draftOverride ?? draft;
      const draftErrors = buildErrors(draftToSave);
      const blockingErrors = getErrorsForTab(tab, draftErrors);
      setSaveAttemptedTabs((current) => ({ ...current, [tab]: true }));

      if (blockingErrors.length > 0) {
        return;
      }
      setSaving(true);
      setAutoSaveStatus("saving");
      const r = await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPatchForTab(tab, draftToSave)),
      });
      const text = await r.text();
      let msg = `Save failed (${r.status})`;
      let payload: Profile | { error?: string } | null = null;

      try {
        payload = text ? (JSON.parse(text) as Profile | { error?: string }) : null;
        if (payload && "error" in payload && payload.error) {
          msg = payload.error;
        }
      } catch {
        payload = null;
      }

      if (!r.ok) throw new Error(msg);

      const updated = normalizeProfileState((payload ?? {}) as Profile);
      setProfile(updated);
      setDraft((current) => applySavedTabToDraft(draftOverride ?? current, updated, tab));
      setSaveAttemptedTabs((current) => ({ ...current, [tab]: false }));
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus("idle"), 2000);
    } catch (error: unknown) {
      setToast({ type: "err", msg: getErrorMessage(error, "Save failed. Try again.") });
      setAutoSaveStatus("idle");
    } finally {
      setSaving(false);
      saveLockRef.current = false;
    }
  }

  /* ── Auto-save: debounce 1.5s after draft changes ── */
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    if (loading) return;
    if (!activeTabDirty) return;
    const tabErrors = getErrorsForTab(activeTab, buildErrors(draftRef.current));
    if (tabErrors.length > 0) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    const tabToSave = activeTab;
    autoSaveTimerRef.current = setTimeout(() => {
      void saveCurrentTab({ tab: tabToSave });
    }, 1500);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabDirty, activeTab, loading, draft]);

  function showToast(type: "ok" | "err", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 2000);
  }

  function boundGetErrorsForTab(tab: TabKey) {
    return getErrorsForTab(tab, errors);
  }

  const handleClearData = useCallback(async () => {
    setClearing(true);
    try {
      const res = await fetch("/api/me/reset", { method: "POST" });
      if (!res.ok) throw new Error("Reset failed");
      router.push(dashboard());
      router.refresh();
    } catch {
      setToast({ type: "err", msg: "Failed to clear data. Try again." });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setClearing(false);
      setShowClearConfirm(false);
    }
  }, [router]);

  const employeeLabel = useMemo(() => {
    const official = (draft.officialName || "").trim();
    if (official) return official;
    const preferred = (draft.userPreferredName || "").trim();
    if (preferred) return preferred;
    const email = (draft.email || "").trim();
    if (!email) return t("common.profile");
    return email.split("@")[0];
  }, [draft.officialName, draft.userPreferredName, draft.email, t]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <ProfileHeader draft={draft} employeeLabel={employeeLabel} />

      <div className="flex items-center gap-3">
        <p className="text-sm text-[var(--color-text-muted)]">{t("account.saveHint")}</p>
        {autoSaveStatus === "saving" ? (
          <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
            <Loader2 className="size-3 animate-spin" />
            {t("common.saving")}
          </span>
        ) : null}
        {autoSaveStatus === "saved" ? (
          <span className="text-xs text-green-400">{t("common.saved")}</span>
        ) : null}
      </div>

      {toast ? (
        <div
          className={cx(
            "mt-4 rounded-lg border px-3 py-2 text-sm",
            toast.type === "ok"
              ? "border-green-200 bg-green-500/10 text-green-800"
              : "border-red-500/20 bg-red-500/10 text-red-400"
          )}
        >
          {toast.msg}
        </div>
      ) : null}

      <div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["profile", employeeLabel],
              ["personal", t("account.personal")],
              ["academic", t("account.academic")],
              ["experience", t("account.experience")],
              ["uploads", t("account.uploads")],
            ] as Array<[TabKey, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cx(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 active:scale-[0.97]",
                activeTab === key
                  ? "bg-[var(--color-button-primary-bg)] text-white shadow-sm scale-100"
                  : "bg-[var(--color-dropdown-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-dropdown-hover)] scale-[0.97] hover:scale-100"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-[var(--color-glass-border)] p-6 text-sm text-[var(--color-text-muted)]">Loading...</div>
        ) : null}

        {!loading && activeTab === "profile" ? (
          <ProfileTab draft={draft} setDraft={setDraft} errors={errors} shouldShowError={shouldShowError} />
        ) : null}

        {!loading && activeTab === "personal" ? (
          <PersonalTab draft={draft} setDraft={setDraft} errors={errors} shouldShowError={shouldShowError} />
        ) : null}

        {!loading && activeTab === "academic" ? (
          <AcademicTab draft={draft} setDraft={setDraft} errors={errors} shouldShowError={shouldShowError} />
        ) : null}

        {!loading && activeTab === "experience" ? (
          <ExperienceTab
            draft={draft}
            setDraft={setDraft}
            errors={errors}
            shouldShowError={shouldShowError}
            saving={saving}
            loading={loading}
            experienceDirty={dirtyByTab.experience}
            saveAttemptedTabs={saveAttemptedTabs}
            saveCurrentTab={saveCurrentTab}
            showToast={showToast}
            getErrorsForTab={boundGetErrorsForTab}
          />
        ) : null}

        {!loading && activeTab === "uploads" ? (
          <UploadsTab draft={draft} setDraft={setDraft} saveCurrentTab={saveCurrentTab} showToast={showToast} />
        ) : null}

        {hasBlockingErrors && activeTabDirty && !loading ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 px-4 py-3 text-sm">
            There are validation issues. Fix them to auto-save.
          </div>
        ) : null}
      </div>

      {/* Danger Zone */}
      <div className="mt-10 rounded-2xl border border-red-500/20 bg-[var(--color-glass-bg)] p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-500" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-400">{t("account.deleteAllMyData")}</h3>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              {t("account.deleteAllWarning")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            disabled={clearing || loading}
            className="shrink-0 rounded-lg border border-red-300 bg-[var(--color-glass-bg)] px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-60"
          >
            {clearing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Clearing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Trash2 className="size-4" />
                Clear Data
              </span>
            )}
          </button>
        </div>
      </div>

      {showClearConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-modal-overlay)] p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--color-modal-bg)] p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-red-500/15">
                <AlertTriangle className="size-5 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Clear All Your Data</h3>
            </div>
            <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
              {t("account.deleteAllWarning")}
            </p>
            <div className="mt-4">
              <label className="text-sm text-[var(--color-text-secondary)]">
                {t("account.typeEmailToConfirm")} <span className="font-mono font-semibold text-red-400">{draft.email}</span>
              </label>
              <input
                type="text"
                value={clearConfirmText}
                onChange={(e) => setClearConfirmText(e.target.value)}
                placeholder={draft.email}
                aria-label="Type your email to confirm"
                className="mt-1.5 w-full rounded-lg border border-[var(--color-input-border)] px-3 py-2 text-sm outline-none transition-colors placeholder:text-[var(--color-text-secondary)] focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                autoFocus
              />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowClearConfirm(false); setClearConfirmText(""); }}
                disabled={clearing}
                className="rounded-lg border border-[var(--color-input-border)] bg-[var(--color-glass-bg)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-dropdown-hover)]"
              >
                Keep My Data
              </button>
              <button
                type="button"
                onClick={() => void handleClearData()}
                disabled={clearConfirmText.toLowerCase() !== (draft.email || "").toLowerCase() || clearing}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {clearing ? t("common.processing") : t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
