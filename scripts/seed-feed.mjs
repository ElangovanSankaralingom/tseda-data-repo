// Seed the department activity feed with sample milestone events so the
// Celebration Wall populates immediately for a visual check.
//
//   node scripts/seed-feed.mjs
//
// Writes to <DATA_ROOT or .data>/feed/activity.json (gitignored). Safe to re-run.

import fs from "node:fs";
import path from "node:path";

const dataRoot = (process.env.DATA_ROOT && process.env.DATA_ROOT.trim()) || ".data";
const feedDir = path.join(process.cwd(), dataRoot, "feed");
const feedPath = path.join(feedDir, "activity.json");

const emptyReactions = () => ({ like: [], fire: [], celebrate: [], clap: [] });
const minutesAgo = (m) => new Date(Date.now() - m * 60_000).toISOString();

const events = [
  {
    id: "streak_won:seed-1",
    type: "streak_won",
    actorEmail: "priya@tce.edu",
    categoryKey: "workshops",
    milestone: null,
    createdAt: minutesAgo(3),
    reactions: { ...emptyReactions(), fire: ["arun@tce.edu", "meera@tce.edu"], celebrate: ["karthik@tce.edu"] },
  },
  {
    id: "milestone:arun@tce.edu:10",
    type: "milestone",
    actorEmail: "arun@tce.edu",
    categoryKey: null,
    milestone: 10,
    createdAt: minutesAgo(12),
    reactions: { ...emptyReactions(), clap: ["priya@tce.edu"], like: ["meera@tce.edu", "karthik@tce.edu"] },
  },
  {
    id: "streak_started:seed-3",
    type: "streak_started",
    actorEmail: "meera@tce.edu",
    categoryKey: "fdp-attended",
    milestone: null,
    createdAt: minutesAgo(28),
    reactions: { ...emptyReactions(), fire: ["priya@tce.edu"] },
  },
  {
    id: "streak_won:seed-4",
    type: "streak_won",
    actorEmail: "karthik@tce.edu",
    categoryKey: "guest-lectures",
    milestone: null,
    createdAt: minutesAgo(95),
    reactions: emptyReactions(),
  },
  {
    id: "streak_started:seed-5",
    type: "streak_started",
    actorEmail: "divya@tce.edu",
    categoryKey: "case-studies",
    milestone: null,
    createdAt: minutesAgo(140),
    reactions: { ...emptyReactions(), celebrate: ["arun@tce.edu"] },
  },
  {
    id: "milestone:priya@tce.edu:25",
    type: "milestone",
    actorEmail: "priya@tce.edu",
    categoryKey: null,
    milestone: 25,
    createdAt: minutesAgo(300),
    reactions: { ...emptyReactions(), fire: ["arun@tce.edu", "meera@tce.edu", "karthik@tce.edu", "divya@tce.edu"] },
  },
];

fs.mkdirSync(feedDir, { recursive: true });
fs.writeFileSync(feedPath, `${JSON.stringify({ version: 1, events }, null, 2)}\n`, "utf8");
console.log(`Seeded ${events.length} feed events -> ${feedPath}`);
