import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--color-body-bg)] px-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-8 text-center shadow-sm">
        <FileQuestion className="mx-auto size-12 text-[var(--color-text-secondary)]" />
        <h1 className="mt-4 text-base font-medium text-[var(--color-text-primary)]">Page not found</h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center rounded-lg bg-[var(--color-button-primary-bg)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--color-primary-light)] hover:shadow"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
