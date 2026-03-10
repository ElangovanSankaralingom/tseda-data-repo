"use client";

import { SessionProvider } from "next-auth/react";
import SearchProvider from "@/components/search/SearchProvider";
import ConfirmationProvider from "@/components/confirmations/ConfirmationProvider";

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <ConfirmationProvider>
        <SearchProvider>{children}</SearchProvider>
      </ConfirmationProvider>
    </SessionProvider>
  );
}
