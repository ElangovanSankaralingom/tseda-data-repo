import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import { cookies } from "next/headers";
import "./globals.css";
import Providers from "./providers";
import NavigationProgress from "@/components/ui/NavigationProgress";
import { buildThemeCss, type ThemeMode, type ColorPalette } from "@/lib/theme/themeTokens";

const COOKIE_MODES: readonly ThemeMode[] = ["light", "dark", "color"];
const COOKIE_PALETTES: readonly ColorPalette[] = ["midnight-lime", "deep-ocean", "carbon-violet", "obsidian-amber"];

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
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
  const rawPalette = jar.get("tseda-palette")?.value as ColorPalette | undefined;
  const mode: ThemeMode = rawMode && COOKIE_MODES.includes(rawMode) ? rawMode : "dark";
  const palette: ColorPalette = rawPalette && COOKIE_PALETTES.includes(rawPalette) ? rawPalette : "midnight-lime";

  return (
    <html lang="en" className={`${plusJakarta.variable} ${GeistMono.variable}`}>
      <body className="antialiased">
        <style dangerouslySetInnerHTML={{ __html: buildThemeCss(mode, palette) }} />
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
