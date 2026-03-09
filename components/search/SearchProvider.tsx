"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import { isMasterAdmin } from "@/lib/admin";
import CommandPalette from "@/components/search/CommandPalette";
import { type SearchContextValue } from "./searchTypes";

const SearchContext = createContext<SearchContextValue>({
  isOpen: false,
  open: () => {},
  close: () => {},
});

export function useSearch() {
  return useContext(SearchContext);
}

export default function SearchProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const email = session?.user?.email ?? "";
    setIsAdmin(isMasterAdmin(email));

    if (!email) return;
    let cancelled = false;
    void fetch("/api/me/admin-capabilities", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const payload = (await res.json()) as { canAccessAdminConsole?: boolean };
        if (!cancelled) setIsAdmin(Boolean(payload.canAccessAdminConsole));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session?.user?.email]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <SearchContext.Provider value={{ isOpen, open, close }}>
      {children}
      <CommandPalette isOpen={isOpen} onClose={close} isAdmin={isAdmin} />
    </SearchContext.Provider>
  );
}
