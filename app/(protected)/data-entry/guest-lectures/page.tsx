export default function Page() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Guest Lectures</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use this section to store records of invited guest lectures hosted by you or delivered by you at other institutions and events.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-white/70 p-5 text-sm text-muted-foreground dark:bg-black/20">
        <div className="text-base font-semibold text-foreground">What belongs here</div>
        <p className="mt-2">
          Capture the lecture topic, institution, speaker or invitee details, mode, date, audience, and the proof associated with each guest lecture.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-white/70 p-5 text-sm text-muted-foreground dark:bg-black/20">
        <div className="text-base font-semibold text-foreground">Typical supporting records</div>
        <div className="mt-2 space-y-1">
          <div>Invitation or approval communication</div>
          <div>Brochure, schedule, or event notice</div>
          <div>Certificate, report, poster, or event photographs</div>
        </div>
      </div>
    </div>
  );
}
