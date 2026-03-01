"use client";

import Image from "next/image";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function GoogleIcon({ className }: { className?: string }) {
  // Simple, crisp Google "G" mark (SVG), no external deps.
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 48 48"
      aria-hidden="true"
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.694 32.655 29.255 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.239 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.651-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 19.002 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.239 4 24 4c-7.682 0-14.33 4.329-17.694 10.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.138 0 9.86-1.977 13.409-5.197l-6.19-5.238C29.2 35.091 26.715 36 24 36c-5.234 0-9.66-3.319-11.29-7.946l-6.52 5.02C9.514 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.78 2.247-2.345 4.165-4.084 5.565l.003-.002 6.19 5.238C36.973 39.205 44 34 44 24c0-1.341-.138-2.651-.389-3.917z"
      />
    </svg>
  );
}

export default function SignInPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useSearchParams();

  const [busy, setBusy] = useState(false);

  // If already signed in, go to dashboard (or your protected home)
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  const errorText = useMemo(() => {
    const e = params.get("error");
    if (!e) return "";
    // Keep it user-friendly; avoid technical codes.
    if (e.toLowerCase().includes("accessdenied")) return "Access denied. Please sign in using your tce.edu ID.";
    return "Sign-in failed. Please try again.";
  }, [params]);

  return (
    <div className="min-h-[calc(100vh-0px)] w-full bg-background">
      {/* Subtle neutral background */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-60 dark:opacity-40"
        style={{
          background:
            "radial-gradient(900px 500px at 50% 20%, rgba(0,0,0,0.06), transparent 60%), radial-gradient(700px 420px at 20% 80%, rgba(0,0,0,0.05), transparent 60%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-5 py-10">
        <div className="w-full max-w-lg">
          {/* Card */}
          <div className="rounded-3xl border border-border bg-white/70 p-6 shadow-sm backdrop-blur-md dark:bg-black/20 sm:p-7">
            {/* Logos row */}
            <div className="flex items-center justify-center">
              <div className="flex items-center justify-center gap-3">
                <div className="relative h-16 w-36 sm:h-20 sm:w-44 md:h-24 md:w-52">
                  <Image
                    src="/tce-logo.png"
                    alt="TCE"
                    fill
                    sizes="(min-width: 768px) 208px, (min-width: 640px) 176px, 144px"
                    className="object-contain"
                    priority
                  />
                </div>

                {/* divider */}
                <div className="h-10 w-px bg-border" />

                <div className="relative h-16 w-36 sm:h-20 sm:w-44 md:h-24 md:w-52">
                  <Image
                    src="/tseda-logo.png"
                    alt="T'SEDA"
                    fill
                    sizes="(min-width: 768px) 208px, (min-width: 640px) 176px, 144px"
                    className="object-contain"
                    priority
                  />
                </div>
              </div>
            </div>

            {/* Title */}
            <div className="mt-5 text-center">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                T&apos;SEDA Data Repository
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Sign in with your tce.edu ID only.
              </p>
            </div>

            {/* Error */}
            {errorText ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                {errorText}
              </div>
            ) : null}

            {/* CTA */}
            <div className={cx("mt-5", errorText ? "mt-4" : "")}>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setBusy(true);
                    // Keep callbackUrl consistent with your app routing
                    await signIn("google", { callbackUrl: "/dashboard" });
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy || status === "loading"}
                className={cx(
                  "group flex w-full items-center justify-center gap-3 rounded-2xl border border-border px-4 py-3 text-sm font-medium",
                  "bg-foreground text-background shadow-sm transition",
                  "hover:opacity-95 active:opacity-90",
                  "disabled:cursor-not-allowed disabled:opacity-60 disabled:pointer-events-none"
                )}
              >
                <span className="inline-flex items-center justify-center rounded-full bg-background/90 p-1">
                  <GoogleIcon className="h-5 w-5" />
                </span>
                <span>{busy ? "Signing in…" : "Sign in with Google"}</span>
              </button>

              <div className="mt-3 text-center text-xs text-muted-foreground">
                Access is restricted to <span className="font-medium">@tce.edu</span>
              </div>
            </div>
          </div>

          {/* footer hint */}
          <div className="mt-4 text-center text-xs text-muted-foreground">
            If you face issues, sign out of other Google accounts and try again.
          </div>
        </div>
      </div>
    </div>
  );
}
