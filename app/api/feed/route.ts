import { demoAware } from "@/lib/demo/demoAware";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { ALLOWED_EMAIL_SUFFIX } from "@/lib/config/appConfig";
import { listFeedEvents, removeFeedEvent, FEED_REACTIONS, type FeedReaction } from "@/lib/feed/feedStore";
import { backfillFeedIfNeeded } from "@/lib/feed/backfill";
import { resolveFacultyName } from "@/lib/admin/facultyRegistry";
import { isActivityFeedEnabled } from "@/lib/settings/consumer";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { isMasterAdmin } from "@/lib/admin/roles";
import { csrfGuard } from "@/lib/security/csrf";

function firstName(email: string): string {
  const resolved = resolveFacultyName(email);
  if (resolved) return resolved.trim().split(/\s+/)[0] ?? resolved;
  return email.split("@")[0] ?? email;
}

async function GETHandler(request: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !email.endsWith(ALLOWED_EMAIL_SUFFIX)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    enforceRateLimitForRequest({
      request,
      userEmail: email,
      action: "feed.get",
      options: RATE_LIMIT_PRESETS.entryReads,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  if (!(await isActivityFeedEnabled())) {
    return NextResponse.json({ data: { enabled: false, events: [] } });
  }

  // Coherence on EVERY load (Elan's ruling): the sweep self-gates on a
  // versioned marker, so this is one fs.access once a universe is swept —
  // and a full idempotent backfill the first time (or after a version bump).
  await backfillFeedIfNeeded();
  const events = await listFeedEvents(50);
  const shaped = events.map((e) => {
    const reactions: Record<string, number> = {};
    const myReactions: FeedReaction[] = [];
    for (const reaction of FEED_REACTIONS) {
      const list = e.reactions[reaction] ?? [];
      reactions[reaction] = list.length;
      if (list.includes(email)) myReactions.push(reaction);
    }
    return {
      id: e.id,
      type: e.type,
      actorName: firstName(e.actorEmail),
      isSelf: e.actorEmail === email,
      categoryKey: e.categoryKey,
      milestone: e.milestone,
      withNames: e.withNames,
      tier: e.tier,
      createdAt: e.createdAt,
      reactions,
      myReactions,
    };
  });

  return NextResponse.json(
    { data: { enabled: true, events: shaped } },
    { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" } },
  );
}

async function DELETEHandler(request: Request) {
  const csrfBlocked = csrfGuard(request);
  if (csrfBlocked) return csrfBlocked;

  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !isMasterAdmin(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    enforceRateLimitForRequest({
      request,
      userEmail: email,
      action: "feed.delete",
      options: RATE_LIMIT_PRESETS.adminOps,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  let body: { eventId?: unknown };
  try {
    body = (await request.json()) as { eventId?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  if (!eventId) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 });
  }

  const removed = await removeFeedEvent(eventId);
  return NextResponse.json({ data: { removed } });
}

// Demo-mode universe wrapper — every handler runs in the caller's universe.
export const GET = demoAware(GETHandler);
export const DELETE = demoAware(DELETEHandler);
