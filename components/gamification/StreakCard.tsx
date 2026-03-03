import { remainingDaysFromDueAtISO, status, type StreakState } from "@/lib/gamification";

function FlameIcon({
  tone,
  count,
}: {
  tone: "gray" | "color";
  count: string;
}) {
  const fill = tone === "color" ? "#f97316" : "#9ca3af";
  const text = tone === "color" ? "#7c2d12" : "#374151";

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2">
      <svg
        aria-hidden="true"
        className="h-8 w-8"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12.9 2.6c.5 3-1 4.9-2.2 6.4-1 1.3-1.8 2.3-1.8 3.9 0 2 1.6 3.6 3.6 3.6 2.8 0 4.6-2.5 4.6-5.2 0-2.2-1.3-4.5-4.2-8.7Z"
          fill={fill}
        />
        <path
          d="M12 10.5c1.8 2 2.6 3.3 2.6 4.8A2.6 2.6 0 0 1 12 18a2.6 2.6 0 0 1-2.6-2.7c0-1 .5-1.9 1.4-3 .4-.5.8-1.1 1.2-1.8Z"
          fill={tone === "color" ? "#fdba74" : "#d1d5db"}
        />
      </svg>
      <span className="text-2xl font-semibold" style={{ color: text }}>
        {count}
      </span>
    </div>
  );
}

export default function StreakCard({
  state,
  label = "Streak Activated",
}: {
  state: StreakState;
  label?: string;
}) {
  const currentStatus = status(state);

  if (currentStatus === "inactive") {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
      {currentStatus === "active" ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FlameIcon tone="gray" count="1" />
            <div>
              <div className="text-sm font-semibold">{label}</div>
              <div className="text-xs text-muted-foreground">
                {remainingDaysFromDueAtISO(state.dueAtISO)} days remaining
              </div>
            </div>
          </div>
        </div>
      ) : currentStatus === "completed" ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FlameIcon tone="color" count="1" />
            <FlameIcon tone="gray" count="0" />
          </div>
          <div className="text-sm font-semibold">Completed</div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FlameIcon tone="gray" count="1" />
            <FlameIcon tone="color" count="0" />
          </div>
          <div className="text-sm font-semibold">Expired</div>
        </div>
      )}
    </div>
  );
}
