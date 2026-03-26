import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import NavigationRefresh from "@/components/NavigationRefresh";
import NetworkStatus from "@/components/NetworkStatus";
import ShellClient from "@/app/ShellClient";
import ThemeProvider from "@/lib/theme/ThemeProvider";
import { authOptions } from "@/lib/auth";
import { findFacultyByEmail, normalizeEmail } from "@/lib/facultyDirectory";
import { signin } from "@/lib/entryNavigation";
import { getUserPreferences } from "@/lib/preferences/userPreferences";
import { ALLOWED_EMAIL_SUFFIX } from "@/lib/config/appConfig";
import type { ThemeMode, ColorPalette } from "@/lib/theme/themeTokens";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) redirect(signin());

  const email = session.user.email.toLowerCase();
  if (!email.endsWith(ALLOWED_EMAIL_SUFFIX) || !findFacultyByEmail(email)) {
    redirect(`${signin()}?error=AccessDenied`);
  }

  const prefs = getUserPreferences(normalizeEmail(email));

  return (
    <ThemeProvider
      initialMode={prefs.themeMode as ThemeMode}
      initialPalette={prefs.colorPalette as ColorPalette}
    >
      <ShellClient>
        <NavigationRefresh />
        <NetworkStatus />
        {children}
      </ShellClient>
    </ThemeProvider>
  );
}
