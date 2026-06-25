import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import NavigationRefresh from "@/components/NavigationRefresh";
import NetworkStatus from "@/components/NetworkStatus";
import ShellClient from "@/app/ShellClient";
import ThemeProvider from "@/lib/theme/ThemeProvider";
import { authOptions } from "@/lib/auth";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { isFacultyAllowed } from "@/lib/admin/facultyRegistry";
import { signin } from "@/lib/entryNavigation";
import { getUserPreferences } from "@/lib/preferences/userPreferences";
import { ALLOWED_EMAIL_SUFFIX } from "@/lib/config/appConfig";
import { buildThemeCss } from "@/lib/theme/themeTokens";
import type { ThemeMode } from "@/lib/theme/themeTokens";
import { normaliseAccent } from "@/lib/theme/accent";
import type { Language } from "@/lib/i18n";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) redirect(signin());

  const email = session.user.email.toLowerCase();
  // Registry-backed allowlist (seeded from the prior hardcoded list); inactive
  // faculty are blocked, the root master is always allowed.
  if (!email.endsWith(ALLOWED_EMAIL_SUFFIX) || !isFacultyAllowed(email)) {
    redirect(`${signin()}?error=AccessDenied`);
  }

  const prefs = getUserPreferences(normalizeEmail(email));
  const mode = prefs.themeMode as ThemeMode;
  // Prefer the saved custom accent; fall back to a legacy preset name (migration).
  const accent = normaliseAccent(prefs.accentHex || prefs.colorPalette);

  return (
    <ThemeProvider
      initialMode={mode}
      initialAccent={accent}
      initialLanguage={prefs.language as Language}
    >
      {/* First-paint theming: resolved tokens + .dark class BEFORE hydration.
          The <style> overrides the static dark fallback in globals.css (same
          specificity, later in source order); the inline script is parser-
          blocking, so the class is correct before anything below it paints.
          ThemeProvider takes over on the client after hydration. */}
      <style dangerouslySetInnerHTML={{ __html: buildThemeCss(mode, accent) }} />
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.classList.toggle("dark",${mode === "dark"});`,
        }}
      />
      <ShellClient>
        <NavigationRefresh />
        <NetworkStatus />
        {children}
      </ShellClient>
    </ThemeProvider>
  );
}
