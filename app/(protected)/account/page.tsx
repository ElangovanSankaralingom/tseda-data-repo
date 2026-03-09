"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ProfileHeader from "@/components/account/ProfileHeader";
import ProfileTab from "@/components/account/ProfileTab";
import PersonalTab from "@/components/account/PersonalTab";
import AcademicTab from "@/components/account/AcademicTab";
import ExperienceTab from "@/components/account/ExperienceTab";
import UploadsTab from "@/components/account/UploadsTab";
import { MiniButton } from "@/components/account/AccountUI";
import {
  cx,
  buildErrors,
  buildPatchForTab,
  getErrorsForTab,
  getTabErrorMessage,
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
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

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
    return tab ? saveAttemptedTabs[tab] : false;
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
  const hasBlockingErrors = saveAttemptedTabs[activeTab] && activeTabErrors.length > 0;

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
        setToast({ type: "err", msg: getTabErrorMessage(tab, blockingErrors) });
        return;
      }
      setSaving(true);
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
      setToast({ type: "ok", msg: "Saved." });
    } catch (error: unknown) {
      setToast({ type: "err", msg: getErrorMessage(error, "Save failed. Try again.") });
    } finally {
      setSaving(false);
      saveLockRef.current = false;
      setTimeout(() => setToast(null), 2000);
    }
  }

  function cancel() {
    setDraft((current) => applySavedTabToDraft(current, profile, activeTab));
    setSaveAttemptedTabs((current) => ({ ...current, [activeTab]: false }));
    setToast({ type: "ok", msg: "Changes discarded." });
    setTimeout(() => setToast(null), 1200);
  }

  function showToast(type: "ok" | "err", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 2000);
  }

  function boundGetErrorsForTab(tab: TabKey) {
    return getErrorsForTab(tab, errors);
  }

  const employeeLabel = useMemo(() => {
    const official = (draft.officialName || "").trim();
    if (official) return official;
    const preferred = (draft.userPreferredName || "").trim();
    if (preferred) return preferred;
    const email = (draft.email || "").trim();
    if (!email) return "Profile";
    return email.split("@")[0];
  }, [draft.officialName, draft.userPreferredName, draft.email]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <ProfileHeader draft={draft} employeeLabel={employeeLabel} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Click Save once you complete your updates.</p>
        </div>

        {activeTabDirty ? (
          <div className="flex items-center gap-2">
            <MiniButton variant="ghost" onClick={cancel} disabled={saving || loading}>
              Cancel
            </MiniButton>
            <MiniButton
              onClick={() => void saveCurrentTab({ tab: activeTab })}
              disabled={saving || loading || hasBlockingErrors || !activeTabDirty}
            >
              {saving ? "Saving..." : "Save"}
            </MiniButton>
          </div>
        ) : null}
      </div>

      {toast ? (
        <div
          className={cx(
            "mt-4 rounded-lg border px-3 py-2 text-sm",
            toast.type === "ok"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
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
              ["personal", "Personal"],
              ["academic", "Academic"],
              ["experience", "Experience"],
              ["uploads", "Uploads"],
            ] as Array<[TabKey, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cx(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 active:scale-[0.97]",
                activeTab === key
                  ? "bg-slate-900 text-white shadow-sm scale-100"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 scale-[0.97] hover:scale-100"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">Loading...</div>
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

        {hasBlockingErrors && !loading ? (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
            There are validation issues. Fix them before saving.
          </div>
        ) : null}
      </div>
    </div>
  );
}
