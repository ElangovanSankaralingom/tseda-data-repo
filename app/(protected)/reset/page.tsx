"use client";

export const dynamic = "force-dynamic";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { isMasterAdmin } from "@/lib/admin";
import { dashboard } from "@/lib/entryNavigation";
import { AlertTriangle, Trash2, CheckCircle2, Loader2 } from "lucide-react";

type TargetKey =
  | "all-entries" | "fdp-attended" | "fdp-conducted" | "guest-lectures"
  | "case-studies" | "workshops" | "user-profiles" | "uploads"
  | "admin-notifications" | "admin-users" | "maintenance" | "telemetry"
  | "backups" | "everything";

interface TargetOption {
  key: TargetKey;
  label: string;
  description: string;
  group: string;
}

const TARGET_OPTIONS: TargetOption[] = [
  // User Data
  { key: "all-entries", label: "Clear ALL user entries (all categories, all users)", description: "Deletes all category JSON files from every user folder", group: "User Data" },
  { key: "fdp-attended", label: "Clear FDP Attended entries only", description: "Deletes fdp-attended.json from every user folder", group: "User Data" },
  { key: "fdp-conducted", label: "Clear FDP Conducted entries only", description: "Deletes fdp-conducted.json from every user folder", group: "User Data" },
  { key: "guest-lectures", label: "Clear Guest Lectures entries only", description: "Deletes guest-lectures.json from every user folder", group: "User Data" },
  { key: "case-studies", label: "Clear Case Studies entries only", description: "Deletes case-studies.json from every user folder", group: "User Data" },
  { key: "workshops", label: "Clear Workshops entries only", description: "Deletes workshops.json from every user folder", group: "User Data" },
  // User Accounts
  { key: "user-profiles", label: "Clear ALL user profiles and indexes", description: "Deletes index.json from every user folder — users get fresh profiles on next login", group: "User Accounts" },
  // Uploaded Files
  { key: "uploads", label: "Clear ALL uploaded files", description: "Deletes everything inside public/uploads/ (PDFs, permission letters, certificates)", group: "Uploaded Files" },
  // Admin Data
  { key: "admin-notifications", label: "Clear admin notifications", description: "Deletes .data/admin/notifications.json", group: "Admin Data" },
  { key: "admin-users", label: "Clear admin user list", description: "Deletes .data/admin/admin-users.json — recreated on next admin login", group: "Admin Data" },
  // System Data
  { key: "maintenance", label: "Clear maintenance logs", description: "Deletes .data/maintenance/ contents", group: "System Data" },
  { key: "telemetry", label: "Clear telemetry data", description: "Deletes .data/telemetry/ contents", group: "System Data" },
  { key: "backups", label: "Clear backup data", description: "Deletes .data_backups/ contents", group: "System Data" },
];

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ResetPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const email = session?.user?.email ?? "";

  const [selected, setSelected] = useState<Set<TargetKey>>(new Set());
  const [stats, setStats] = useState<Record<string, { count: number; size: number }>>({});
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [result, setResult] = useState<{ totalDeleted: number; results: { target: string; filesDeleted: number }[] } | null>(null);

  // Redirect non-admin
  useEffect(() => {
    if (status === "loading") return;
    if (!isMasterAdmin(email)) {
      router.replace(dashboard());
    }
  }, [email, status, router]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/reset", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json() as { stats: Record<string, { count: number; size: number }>; userCount: number };
        setStats(data.stats);
        setUserCount(data.userCount);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchStats(); }, [fetchStats]);

  if (status === "loading" || !isMasterAdmin(email)) {
    return null;
  }

  function toggleTarget(key: TargetKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (key === "everything") {
        // If selecting everything, clear individual selections
        if (next.has("everything")) {
          next.delete("everything");
        } else {
          next.clear();
          next.add("everything");
        }
        return next;
      }
      // Deselect "everything" if selecting individual items
      next.delete("everything");
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function handleClear() {
    if (confirmText !== "CLEAR") return;
    setClearing(true);
    setShowConfirm(false);
    setConfirmText("");

    try {
      const res = await fetch("/api/admin/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targets: Array.from(selected),
          confirmCode: "CLEAR",
        }),
      });

      if (res.ok) {
        const data = await res.json() as { totalDeleted: number; results: { target: string; filesDeleted: number }[] };
        setResult(data);
        setSelected(new Set());
        void fetchStats();
      }
    } catch { /* ignore */ } finally {
      setClearing(false);
    }
  }

  const selectedLabels = selected.has("everything")
    ? ["EVERYTHING — all data will be cleared"]
    : TARGET_OPTIONS.filter((t) => selected.has(t.key)).map((t) => t.label);

  // Group targets by group name
  const groups = TARGET_OPTIONS.reduce<Record<string, TargetOption[]>>((acc, opt) => {
    (acc[opt.group] ??= []).push(opt);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Testing Reset Center</h1>
        <p className="mt-1 text-sm text-slate-500">
          Clear test data during development. This feature will be removed before production.
        </p>
      </div>

      {/* Warning Banner */}
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-medium text-red-800">
              This permanently deletes data. There is no undo.
            </p>
            <p className="mt-1 text-sm text-red-600">
              Make sure you want to do this. {userCount > 0 && `${userCount} user folder${userCount === 1 ? "" : "s"} detected.`}
            </p>
          </div>
        </div>
      </div>

      {/* Success Result */}
      {result && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                Cleared {result.totalDeleted} file{result.totalDeleted === 1 ? "" : "s"}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-emerald-700">
                {result.results.map((r) => (
                  <li key={r.target}>
                    {r.target}: {r.filesDeleted} file{r.filesDeleted === 1 ? "" : "s"} deleted
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => { router.push(dashboard()); router.refresh(); }}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                >
                  Go to Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  Clear More
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Target Groups */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([groupName, options]) => (
            <div key={groupName} className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
                {groupName}
              </h2>
              <div className="space-y-3">
                {options.map((opt) => {
                  const stat = stats[opt.key];
                  const isChecked = selected.has(opt.key) || selected.has("everything");
                  return (
                    <label
                      key={opt.key}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg p-3 transition-colors ${
                        isChecked ? "bg-red-50 ring-1 ring-red-200" : "hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleTarget(opt.key)}
                        disabled={clearing || (selected.has("everything") && opt.key !== "everything")}
                        className="mt-0.5 size-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium text-slate-800">{opt.label}</span>
                          {stat && stat.count > 0 && (
                            <span className="shrink-0 text-xs text-slate-400">
                              {stat.count} file{stat.count === 1 ? "" : "s"}, {formatSize(stat.size)}
                            </span>
                          )}
                          {stat && stat.count === 0 && (
                            <span className="shrink-0 text-xs text-slate-300">empty</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">{opt.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Nuclear Option */}
          <div className="rounded-xl border-2 border-red-200 bg-white p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-px flex-1 bg-red-200" />
              <span className="text-xs font-semibold uppercase tracking-wider text-red-400">Nuclear Option</span>
              <div className="h-px flex-1 bg-red-200" />
            </div>
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-lg p-3 transition-colors ${
                selected.has("everything") ? "bg-red-100 ring-1 ring-red-300" : "hover:bg-red-50"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has("everything")}
                onChange={() => toggleTarget("everything")}
                disabled={clearing}
                className="mt-0.5 size-4 rounded border-red-300 text-red-600 focus:ring-red-500"
              />
              <div className="flex-1">
                <span className="text-sm font-bold text-red-700">CLEAR EVERYTHING</span>
                <p className="mt-0.5 text-xs text-red-500">
                  Deletes ALL of the above — resets the app to a fresh state
                </p>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Clear Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => { setShowConfirm(true); setConfirmText(""); }}
          disabled={selected.size === 0 || clearing}
          className="rounded-xl bg-red-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {clearing ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Clearing...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Trash2 className="size-4" />
              Clear Selected Data
            </span>
          )}
        </button>
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Clear test data?</h3>
            <div className="mt-3 space-y-1">
              <p className="text-sm text-slate-600">The following will be cleared:</p>
              <ul className="ml-4 list-disc space-y-0.5 text-sm text-slate-700">
                {selectedLabels.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </div>
            <p className="mt-3 text-sm font-medium text-red-600">
              This action cannot be undone.
            </p>
            <div className="mt-4">
              <label className="text-sm text-slate-600">
                Type <span className="font-mono font-bold">CLEAR</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="CLEAR"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
                autoFocus
              />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowConfirm(false); setConfirmText(""); }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleClear()}
                disabled={confirmText !== "CLEAR"}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Yes, Clear Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
