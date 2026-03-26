import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Palette } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { getUserPreferences } from "@/lib/preferences/userPreferences";
import { dashboard } from "@/lib/entryNavigation";
import AppearanceSettings from "@/components/settings/AppearanceSettings";

export const dynamic = "force-dynamic";

export default async function AppearancePage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email) redirect(dashboard());

  const prefs = getUserPreferences(email);

  return (
    <div className="mx-auto max-w-2xl py-6">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-primary-muted)]">
            <Palette className="size-5 text-[var(--color-primary)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Appearance</h1>
            <p className="text-sm text-[var(--color-text-secondary)]">Customise how TSEDA looks for you</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-6 shadow-sm">
        <AppearanceSettings initialLanguage={prefs.language as "en" | "ta"} />
      </div>
    </div>
  );
}
