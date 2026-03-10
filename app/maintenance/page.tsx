import { Wrench } from "lucide-react";
import { getSetting } from "@/lib/settings/store";

export default async function MaintenancePage() {
  const appName = await getSetting<string>("general.appName");
  const message = await getSetting<string>("advanced.maintenanceMessage");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-10 text-center shadow-2xl animate-fade-in-up">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-amber-50">
          <Wrench className="size-8 text-amber-500" style={{ animation: "spin 5s linear infinite" }} />
        </div>
        <h1 className="text-xl font-bold text-slate-900">{appName}</h1>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">{message}</p>
        <p className="mt-6 text-xs text-slate-500">We&apos;ll be back soon</p>
      </div>
    </div>
  );
}
