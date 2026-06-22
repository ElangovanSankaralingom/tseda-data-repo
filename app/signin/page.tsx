"use client";

import Image from "next/image";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { dashboard } from "@/lib/entryNavigation";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function GoogleIcon({ className }: { className?: string }) {
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
  const { status } = useSession();
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(dashboard());
    }
  }, [status, router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");

    if (!error) {
      setErrorText("");
      return;
    }

    if (error.toLowerCase().includes("accessdenied")) {
      setErrorText("Access denied. Your tce.edu account is not listed in the faculty directory.");
      return;
    }

    setErrorText("Sign-in failed. Please try again.");
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[var(--color-body-bg)]">
      {/* Ambient glow orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(600px at 50% 30%, rgba(138, 162, 248, 0.07), transparent), radial-gradient(400px at 70% 70%, rgba(59, 130, 246, 0.04), transparent)",
        }}
      />
      {/* Drifting blue orb */}
      <div aria-hidden="true" className="pointer-events-none fixed left-1/2 top-1/4 -z-10 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-primary)]/5 blur-3xl animate-glow-drift" />
      {/* Secondary blue orb */}
      <div aria-hidden="true" className="pointer-events-none fixed right-1/4 bottom-1/4 -z-10 h-72 w-72 rounded-full bg-[var(--color-primary)]/[0.03] blur-3xl animate-glow-drift" style={{ animationDelay: "-3s" }} />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-5 py-10">
        <div className="w-full max-w-lg animate-page-enter">
          {/* Card — glass treatment */}
          <div className="rounded-3xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] p-6 shadow-[0_2px_8px_rgba(20,30,70,0.06),0_30px_60px_-28px_rgba(20,30,70,0.35)] backdrop-blur-xl sm:p-8 animate-float">
            {/* Logos row */}
            <div className="flex items-center justify-center">
              <div className="flex items-center justify-center gap-3">
                <div className="relative h-16 w-36 sm:h-20 sm:w-44 md:h-24 md:w-52">
                  <Image
                    src="/tce-logo.png"
                    alt="TCE"
                    fill
                    sizes="(min-width: 768px) 208px, (min-width: 640px) 176px, 144px"
                    className="object-contain drop-shadow-[0_0_12px_rgba(138,162,248,0.18)]"
                    priority
                  />
                </div>

                {/* divider */}
                <div className="h-10 w-px bg-[var(--color-glass-border)]" />

                <div className="relative h-16 w-36 sm:h-20 sm:w-44 md:h-24 md:w-52">
                  <Image
                    src="/tseda-logo.png"
                    alt="T'SEDA"
                    fill
                    sizes="(min-width: 768px) 208px, (min-width: 640px) 176px, 144px"
                    className="object-contain drop-shadow-[0_0_12px_rgba(138,162,248,0.18)]"
                    priority
                  />
                </div>
              </div>
            </div>

            {/* Title */}
            <div className="mt-6 text-center animate-fade-in-up">
              <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)] sm:text-[28px]">
                T&apos;SEDA Data Repository
              </h1>
              {/* Accent line — lime gradient */}
              <div className="mx-auto mt-2.5 h-0.5 w-16 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)] animate-grow-width" />
              <p className="mt-2.5 text-sm text-[var(--color-text-secondary)]">
                Sign in with your tce.edu ID only.
              </p>
            </div>

            {/* Error */}
            {errorText ? (
              <div className="mt-4 rounded-xl border border-[var(--color-status-error-border)] bg-[var(--color-status-error-bg)] px-3 py-2 text-sm text-[var(--color-status-error)] backdrop-blur-sm animate-fade-in-up">
                {errorText}
              </div>
            ) : null}

            {/* CTA */}
            <div className={cx("mt-6", errorText ? "mt-4" : "")}>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setBusy(true);
                    await signIn("google", { callbackUrl: dashboard() });
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy || status === "loading"}
                className={cx(
                  "group flex w-full items-center justify-center gap-3 rounded-2xl border border-[var(--color-glass-border)] px-4 py-3.5 text-sm font-semibold",
                  "bg-[var(--color-glass-hover)] text-[var(--color-text-primary)] shadow-[0_8px_24px_-10px_rgba(20,30,70,0.25)] cursor-pointer transition-all duration-300 ease-out",
                  "hover:bg-[var(--color-button-primary-bg)] hover:text-[var(--color-button-primary-text)] hover:border-[var(--color-primary)]/30 hover:shadow-[0_0_24px_var(--color-glow-primary)]",
                  "active:translate-y-0 active:scale-[0.97]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40",
                  "disabled:cursor-not-allowed disabled:opacity-60 disabled:pointer-events-none",
                  "disabled:hover:shadow-none disabled:hover:translate-y-0 disabled:active:scale-100",
                  "animate-fade-in-up stagger-2"
                )}
              >
                {/* Brand exception: the multicolor Google "G" needs a light backing
                    disc in BOTH light and dark mode, so bg-white/90 is intentional
                    and mode-invariant (allowlisted in scripts/check-theme-tokens.mjs). */}
                <span className="inline-flex items-center justify-center rounded-full bg-white/90 p-1 transition-transform duration-200 group-hover:rotate-[5deg] group-hover:scale-110">
                  <GoogleIcon className="h-5 w-5" />
                </span>
                <span>{busy ? "Signing in\u2026" : "Sign in with Google"}</span>
              </button>

              <div className="mt-3.5 flex items-center justify-center gap-1.5 text-center text-xs text-[var(--color-text-muted)] animate-fade-in-up stagger-3">
                <svg viewBox="0 0 24 24" className="h-3 w-3 fill-none stroke-current stroke-2" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                Access is restricted to <span className="font-medium text-[var(--color-text-secondary)]">@tce.edu</span> accounts only
              </div>
            </div>
          </div>

          {/* footer hint */}
          <div className="mt-5 text-center text-xs text-[var(--color-text-muted)] animate-fade-in-up stagger-4">
            If you face issues, sign out of other Google accounts and try again.
          </div>
          <div className="mt-6 text-center text-xs text-[var(--color-text-muted)]/60 animate-fade-in-up stagger-5">
            T&apos;SEDA &mdash; Thiagarajar College of Engineering
          </div>
        </div>
      </div>
    </div>
  );
}
