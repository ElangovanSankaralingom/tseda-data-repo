function FlameIcon({
  tone,
  count,
  animated,
}: {
  tone: "gray" | "color";
  count: number;
  animated?: boolean;
}) {
  const fill = tone === "color" ? "#f97316" : "#9ca3af";
  const text = tone === "color" ? "#7c2d12" : "#374151";

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
      <svg
        aria-hidden="true"
        className={
          tone === "gray"
            ? `h-5 w-5 ${animated ? "animate-pulse [animation-duration:2.8s]" : ""}`
            : `h-6 w-6 ${animated ? "animate-pulse [animation-duration:3.4s] drop-shadow-[0_0_12px_rgba(249,115,22,0.35)]" : ""}`
        }
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
      <span className="text-xl font-semibold leading-none" style={{ color: text }}>
        {count}
      </span>
    </div>
  );
}

function toDisplayCount(value: number | undefined) {
  if (typeof value !== "number") return null;
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

export default function StreakSummaryCard({
  coloredCount,
  greyCount,
  detail,
  animateColored = false,
  animateGrey = false,
  detailChip = false,
  className,
}: {
  coloredCount?: number;
  greyCount?: number;
  detail?: string;
  animateColored?: boolean;
  animateGrey?: boolean;
  detailChip?: boolean;
  className?: string;
}) {
  const safeColoredCount = toDisplayCount(coloredCount);
  const safeGreyCount = toDisplayCount(greyCount);

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className ?? ""}`}>
      {safeColoredCount !== null ? (
        <FlameIcon tone="color" count={safeColoredCount} animated={animateColored} />
      ) : null}
      {safeGreyCount !== null ? (
        <FlameIcon tone="gray" count={safeGreyCount} animated={animateGrey} />
      ) : null}
      {detail ? (
        <div
          className={
            detailChip
              ? "whitespace-nowrap rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
              : "whitespace-nowrap text-sm text-muted-foreground"
          }
        >
          {detail}
        </div>
      ) : null}
    </div>
  );
}
