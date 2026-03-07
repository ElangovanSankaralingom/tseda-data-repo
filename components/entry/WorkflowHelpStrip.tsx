export default function WorkflowHelpStrip({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={["rounded-xl border border-slate-200 bg-slate-50 px-3 py-2", className ?? ""].join(" ")}>
      <div className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Save Draft</span> saves and stays.{" "}
        <span className="font-medium text-foreground">Save &amp; Close</span> saves and exits.{" "}
        <span className="font-medium text-foreground">Send for Confirmation</span> is a separate admin-review action.{" "}
        <span className="font-medium text-foreground">Approved</span> entries are final.
      </div>
    </div>
  );
}
