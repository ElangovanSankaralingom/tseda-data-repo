"use client";

import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import SearchProvider from "@/components/search/SearchProvider";
import ConfirmationProvider from "@/components/confirmations/ConfirmationProvider";

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      void import("@/lib/utils/a11y").then((m) => m.initAxeA11y());
    }
  }, []);

  return (
    <SessionProvider>
      <ConfirmationProvider>
        <SearchProvider>{children}</SearchProvider>
      </ConfirmationProvider>
    </SessionProvider>
  );
}
