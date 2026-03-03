import { getEntryTag, type EntryDisplayCategory } from "@/lib/entries/lifecycle";

function FlameStatusIcon({ tone }: { tone: "gray" | "color" }) {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12.9 2.6c.5 3-1 4.9-2.2 6.4-1 1.3-1.8 2.3-1.8 3.9 0 2 1.6 3.6 3.6 3.6 2.8 0 4.6-2.5 4.6-5.2 0-2.2-1.3-4.5-4.2-8.7Z"
        fill={tone === "color" ? "#f97316" : "#9ca3af"}
      />
      <path
        d="M12 10.5c1.8 2 2.6 3.3 2.6 4.8A2.6 2.6 0 0 1 12 18a2.6 2.6 0 0 1-2.6-2.7c0-1 .5-1.9 1.4-3 .4-.5.8-1.1 1.2-1.8Z"
        fill={tone === "color" ? "#fdba74" : "#d1d5db"}
      />
    </svg>
  );
}

function SlashedFireIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 shrink-0 text-muted-foreground opacity-70"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12.9 2.6c.5 3-1 4.9-2.2 6.4-1 1.3-1.8 2.3-1.8 3.9 0 2 1.6 3.6 3.6 3.6 2.8 0 4.6-2.5 4.6-5.2 0-2.2-1.3-4.5-4.2-8.7Z"
        fill="#9ca3af"
      />
      <path
        d="M12 10.5c1.8 2 2.6 3.3 2.6 4.8A2.6 2.6 0 0 1 12 18a2.6 2.6 0 0 1-2.6-2.7c0-1 .5-1.9 1.4-3 .4-.5.8-1.1 1.2-1.8Z"
        fill="#d1d5db"
      />
      <path d="M5 5 19 19" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

export default function EntryCategoryMarker({
  category,
  index,
}: {
  category: EntryDisplayCategory;
  index: number;
}) {
  return (
    <>
      <span className="text-xs font-mono text-muted-foreground">{getEntryTag(category, index)}</span>
      {category === "streak_active" ? <FlameStatusIcon tone="gray" /> : null}
      {category === "completed" ? <FlameStatusIcon tone="color" /> : null}
      {category === "generic" ? <SlashedFireIcon /> : null}
    </>
  );
}
