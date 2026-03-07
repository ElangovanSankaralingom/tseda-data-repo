import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import NavigationProgress from "@/components/ui/NavigationProgress";

export const metadata: Metadata = {
  title: "T'SEDA Data Repository",
  description: "Faculty data repository",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <NavigationProgress />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
