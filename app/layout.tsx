import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import { cookies } from "next/headers";
import "./globals.css";
import Providers from "./providers";
import NavigationProgress from "@/components/ui/NavigationProgress";
import { buildThemeCss, type ThemeMode } from "@/lib/theme/themeTokens";
import { normaliseAccent } from "@/lib/theme/accent";

const COOKIE_MODES: readonly ThemeMode[] = ["light", "dark", "color"];

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "T'SEDA Data Repository",
  description: "Faculty data repository",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /* Theme cookie (mirrored by ThemeProvider): lets PUBLIC pages — signin,
     maintenance — first-paint in the visitor's last-known theme instead of
     the static dark fallback. Values are validated against the typed unions;
     unknown/absent → product default (dark). Authenticated pages override
     this with server-stored prefs in app/(protected)/layout.tsx. */
  const jar = await cookies();
  const rawMode = jar.get("tseda-mode")?.value as ThemeMode | undefined;
  const rawAccent = jar.get("tseda-accent")?.value;
  const rawPalette = jar.get("tseda-palette")?.value; // legacy cookie (migration)
  const mode: ThemeMode = rawMode && COOKIE_MODES.includes(rawMode) ? rawMode : "dark";
  const accent = normaliseAccent(rawAccent ? decodeURIComponent(rawAccent) : rawPalette);

  return (
    <html lang="en" className={`${hanken.variable} ${GeistMono.variable}`}>
      <body className="antialiased">
        <style dangerouslySetInnerHTML={{ __html: buildThemeCss(mode, accent) }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.toggle("dark",${mode === "dark"});`,
          }}
        />
        <NavigationProgress />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
