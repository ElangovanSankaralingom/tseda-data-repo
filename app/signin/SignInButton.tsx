"use client";

import { signIn, useSession } from "next-auth/react";

export default function SignInButton() {
  const { status } = useSession();

  return (
    <button
      type="button"
      disabled={status === "loading"}
      onClick={() => signIn("google", { callbackUrl: "/" })}
      className="w-full rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-glass-hover)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-primary)] transition-all duration-200 hover:bg-[var(--color-button-primary-bg)] hover:text-[var(--color-button-primary-text)] hover:border-[var(--color-primary)]/30 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {status === "loading" ? "Checking session..." : "Sign in with Google"}
    </button>
  );
}
