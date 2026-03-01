export default function Page() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Case Studies</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use this category to capture case studies developed, documented, or adopted for teaching, field work, or institutional learning.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-white/70 p-5 text-sm text-muted-foreground dark:bg-black/20">
        <div className="text-base font-semibold text-foreground">What belongs here</div>
        <p className="mt-2">
          Maintain the case study title, domain, context, associated course or activity, outcomes, and any evidence that supports its academic or practical use.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-white/70 p-5 text-sm text-muted-foreground dark:bg-black/20">
        <div className="text-base font-semibold text-foreground">Typical supporting records</div>
        <div className="mt-2 space-y-1">
          <div>Case summary or abstract</div>
          <div>Institution, industry, or field context details</div>
          <div>Attachments, reference documents, images, or usage proof</div>
        </div>
      </div>
    </div>
  );
}
