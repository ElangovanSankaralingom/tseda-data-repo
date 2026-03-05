import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { PATCH as patchCaseStudies } from "@/app/api/me/case-studies/route";
import { POST as postCaseStudiesPdf } from "@/app/api/me/case-studies/[id]/pdf/route";
import { PATCH as patchFdpAttended } from "@/app/api/me/fdp-attended/route";
import { POST as postFdpAttendedPdf } from "@/app/api/me/fdp-attended/[id]/pdf/route";
import { PATCH as patchFdpConducted } from "@/app/api/me/fdp-conducted/route";
import { POST as postFdpConductedPdf } from "@/app/api/me/fdp-conducted/[id]/pdf/route";
import { PATCH as patchGuestLectures } from "@/app/api/me/guest-lectures/route";
import { POST as postGuestLecturesPdf } from "@/app/api/me/guest-lectures/[id]/pdf/route";
import { PATCH as patchWorkshops } from "@/app/api/me/workshops/route";
import { POST as postWorkshopsPdf } from "@/app/api/me/workshops/[id]/pdf/route";
import { authOptions } from "@/lib/auth";
import type { CategoryKey } from "@/lib/entries/types";
import { assertActionPayload, assertEntryMutationInput, SECURITY_LIMITS } from "@/lib/security/limits";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";

type SaveHandler = (request: Request) => Promise<Response>;
type PdfHandler = (
  request: Request,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>;

const SAVE_HANDLERS: Record<CategoryKey, SaveHandler> = {
  "fdp-attended": patchFdpAttended,
  "fdp-conducted": patchFdpConducted,
  "case-studies": patchCaseStudies,
  "guest-lectures": patchGuestLectures,
  workshops: patchWorkshops,
};

const PDF_HANDLERS: Record<CategoryKey, PdfHandler> = {
  "fdp-attended": postFdpAttendedPdf,
  "fdp-conducted": postFdpConductedPdf,
  "case-studies": postCaseStudiesPdf,
  "guest-lectures": postGuestLecturesPdf,
  workshops: postWorkshopsPdf,
};

function buildForwardHeaders(request: Request, contentType?: string) {
  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  if (cookie) {
    headers.set("cookie", cookie);
  }
  if (contentType) {
    headers.set("content-type", contentType);
  }
  return headers;
}

async function getAuthorizedEmail() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? "";
  if (!email.endsWith("@tce.edu")) {
    return null;
  }
  return email;
}

async function parseJsonPayload(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function runGenerateEntryRequest(
  request: Request,
  args: {
    categoryKey: CategoryKey;
    id?: string;
    draft?: unknown;
  }
) {
  const email = await getAuthorizedEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  enforceRateLimitForRequest({
    request,
    userEmail: email,
    action: `entry.generate.${args.categoryKey}`,
    options: RATE_LIMIT_PRESETS.entryMutations,
  });

  assertActionPayload(
    args,
    "generate request",
    SECURITY_LIMITS.entryPayloadMaxBytes + SECURITY_LIMITS.actionPayloadMaxBytes
  );

  const saveHandler = SAVE_HANDLERS[args.categoryKey];
  const pdfHandler = PDF_HANDLERS[args.categoryKey];

  if (!saveHandler || !pdfHandler) {
    return NextResponse.json({ error: "Unsupported category" }, { status: 404 });
  }

  const draftRecord =
    args.draft && typeof args.draft === "object" ? (args.draft as Record<string, unknown>) : null;
  const requestedId = String(draftRecord?.id ?? args.id ?? "").trim();

  if (draftRecord) {
    assertEntryMutationInput(draftRecord, "generate draft");
  }

  if (!requestedId) {
    return NextResponse.json({ error: "entry id required" }, { status: 400 });
  }

  const nextDraft = draftRecord ? { ...draftRecord, id: requestedId } : { id: requestedId };

  const saveRequest = new Request(request.url, {
    method: "PATCH",
    headers: buildForwardHeaders(request, "application/json"),
    body: JSON.stringify({
      email,
      entry: nextDraft,
    }),
  });

  const saveResponse = await saveHandler(saveRequest);
  const savePayload = await parseJsonPayload(saveResponse);

  if (!saveResponse.ok) {
    return NextResponse.json(
      savePayload && typeof savePayload === "object"
        ? savePayload
        : { error: `Save failed (${saveResponse.status})` },
      { status: saveResponse.status }
    );
  }

  const savedEntry =
    savePayload && typeof savePayload === "object" && "id" in savePayload
      ? (savePayload as Record<string, unknown>)
      : null;
  const persistedId = String(savedEntry?.id ?? requestedId).trim();

  if (!persistedId) {
    return NextResponse.json(
      { error: "Entry could not be persisted before generating." },
      { status: 500 }
    );
  }

  const pdfRequest = new Request(request.url, {
    method: "POST",
    headers: buildForwardHeaders(request),
  });

  return pdfHandler(pdfRequest, {
    params: Promise.resolve({ id: persistedId }),
  });
}
