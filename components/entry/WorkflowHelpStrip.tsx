import Link from "next/link";
import { helpHome } from "@/lib/entryNavigation";

export default function WorkflowHelpStrip({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={["rounded-xl border border-border bg-muted/30 px-3 py-2", className ?? ""].join(" ")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Save Draft</span> saves and stays.{" "}
          <span className="font-medium text-foreground">Save &amp; Close</span> saves and exits.{" "}
          <span className="font-medium text-foreground">Send for Confirmation</span> is a separate admin-review action.{" "}
          <span className="font-medium text-foreground">Approved</span> entries are final.
        </div>
        <Link
          href={helpHome()}
          className="inline-flex h-8 shrink-0 items-center rounded-lg border border-border px-2.5 text-xs font-medium transition hover:bg-muted"
        >
          How this works
        </Link>
      </div>
    </div>
  );
}
