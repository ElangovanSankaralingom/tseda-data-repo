import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { ALLOWED_EMAIL_SUFFIX } from "@/lib/config/appConfig";
import { toggleReaction, FEED_REACTIONS, type FeedReaction } from "@/lib/feed/feedStore";
import { isActivityFeedEnabled } from "@/lib/settings/consumer";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { csrfGuard } from "@/lib/security/csrf";

export async function POST(request: Request) {
  const csrfBlocked = csrfGuard(request);
  if (csrfBlocked) return csrfBlocked;

  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !email.endsWith(ALLOWED_EMAIL_SUFFIX)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    enforceRateLimitForRequest({
      request,
      userEmail: email,
      action: "feed.react",
      options: RATE_LIMIT_PRESETS.entryMutations,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  if (!(await isActivityFeedEnabled())) {
    return NextResponse.json({ error: "Activity feed is disabled" }, { status: 403 });
  }

  let body: { eventId?: unknown; reaction?: unknown };
  try {
    body = (await request.json()) as { eventId?: unknown; reaction?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  const reaction = typeof body.reaction === "string" ? body.reaction : "";
  if (!eventId || !(FEED_REACTIONS as readonly string[]).includes(reaction)) {
    return NextResponse.json({ error: "Invalid eventId or reaction" }, { status: 400 });
  }

  const updated = await toggleReaction(eventId, reaction, email);
  if (!updated) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const reactions: Record<string, number> = {};
  const myReactions: FeedReaction[] = [];
  for (const r of FEED_REACTIONS) {
    const list = updated.reactions[r] ?? [];
    reactions[r] = list.length;
    if (list.includes(email)) myReactions.push(r);
  }

  return NextResponse.json({ data: { id: updated.id, reactions, myReactions } });
}
