import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#FAFBFC] px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <FileQuestion className="mx-auto size-12 text-slate-400" />
        <h1 className="mt-4 text-base font-medium text-slate-700">Page not found</h1>
        <p className="mt-2 text-sm text-slate-500">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#2D5F8A] hover:shadow"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
