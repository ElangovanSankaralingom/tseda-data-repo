import { Wrench } from "lucide-react";
import { getSetting } from "@/lib/settings/store";

export default async function MaintenancePage() {
  const appName = await getSetting<string>("general.appName");
  const message = await getSetting<string>("advanced.maintenanceMessage");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[var(--color-gradient-from)] to-[var(--color-gradient-to)] p-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-glass-bg)] p-10 text-center shadow-2xl animate-fade-in-up">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-[var(--color-status-warning-bg)]">
          <Wrench className="size-8 text-[var(--color-status-warning)]" style={{ animation: "spin 5s linear infinite" }} />
        </div>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">{appName}</h1>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)] leading-relaxed">{message}</p>
        <p className="mt-6 text-xs text-[var(--color-text-secondary)]">We&apos;ll be back soon</p>
      </div>
    </div>
  );
}
