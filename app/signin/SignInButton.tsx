"use client";

import { signIn, useSession } from "next-auth/react";

export default function SignInButton() {
  const { status } = useSession();

  return (
    <button
      type="button"
      disabled={status === "loading"}
      onClick={() => signIn("google", { callbackUrl: "/" })}
      className="w-full rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {status === "loading" ? "Checking session..." : "Sign in with Google"}
    </button>
  );
}
