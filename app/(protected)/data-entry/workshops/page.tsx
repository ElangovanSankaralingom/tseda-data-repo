export default function Page() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workshops</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use this section to record workshop activities, whether they were attended, coordinated, conducted, or hosted as part of academic work.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-white/70 p-5 text-sm text-muted-foreground dark:bg-black/20">
        <div className="text-base font-semibold text-foreground">What belongs here</div>
        <p className="mt-2">
          Maintain workshop title, organiser, dates, category, participant details, outcomes, and the supporting material connected to each workshop entry.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-white/70 p-5 text-sm text-muted-foreground dark:bg-black/20">
        <div className="text-base font-semibold text-foreground">Typical supporting records</div>
        <div className="mt-2 space-y-1">
          <div>Approval note or invitation</div>
          <div>Schedule, brochure, or circular</div>
          <div>Completion proof, attendance summary, report, or certificate</div>
        </div>
      </div>
    </div>
  );
}
