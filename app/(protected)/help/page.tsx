import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { adminHome, dataEntryHome } from "@/lib/entryNavigation";

const sections: Array<{ title: string; body: string }> = [
  {
    title: "1) How to create an entry",
    body: "Open Data Entry, select a category, add a new record, and fill in the required fields for that category.",
  },
  {
    title: "2) Save Draft vs Save & Close",
    body: "Save Draft stores current data and keeps you on the page. Save & Close saves, validates commit-required fields, and returns you to the category list.",
  },
  {
    title: "3) Send for Confirmation",
    body: "Send for Confirmation is a separate workflow action. Use it only after your entry is complete and supporting files are uploaded.",
  },
  {
    title: "4) Pending Confirmation",
    body: "Entries sent for confirmation remain pending until an admin reviews and approves or rejects them.",
  },
  {
    title: "5) Approved / Locked state",
    body: "Approved entries are final for normal edits. Rejected entries return to editable draft flow for correction.",
  },
  {
    title: "6) Admin workflow overview",
    body: "Admins review pending confirmations, manage exports and audits, run integrity checks, and maintain backups.",
  },
  {
    title: "7) FAQ",
    body: "If a field is missing or validation fails, keep the entry in draft, complete required details, then Save & Close before sending for confirmation.",
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <PageHeader
        title="Help"
        subtitle="Quick guidance for entry creation, save actions, and admin approval workflow."
      />

      <div className="mt-6 space-y-4">
        <SectionCard title="Quick Links">
          <div className="flex flex-wrap gap-2">
            <Link
              href={dataEntryHome()}
              className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium transition hover:bg-muted"
            >
              Go to Data Entry
            </Link>
            <Link
              href={adminHome()}
              className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium transition hover:bg-muted"
            >
              Admin Console
            </Link>
          </div>
        </SectionCard>

        {sections.map((section) => (
          <SectionCard key={section.title} title={section.title}>
            <p className="text-sm text-muted-foreground">{section.body}</p>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
