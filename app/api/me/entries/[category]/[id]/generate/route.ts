import { NextResponse } from "next/server";
import { POST as postCaseStudiesPdf } from "@/app/api/me/case-studies/[id]/pdf/route";
import { POST as postFdpAttendedPdf } from "@/app/api/me/fdp-attended/[id]/pdf/route";
import { POST as postFdpConductedPdf } from "@/app/api/me/fdp-conducted/[id]/pdf/route";
import { POST as postGuestLecturesPdf } from "@/app/api/me/guest-lectures/[id]/pdf/route";
import { POST as postWorkshopsPdf } from "@/app/api/me/workshops/[id]/pdf/route";
import { isValidCategorySlug } from "@/data/categoryRegistry";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeError } from "@/lib/errors";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";

type GenerateRouteHandler = (
  request: Request,
  context: { params: Promise<{ id: string }> }
) => Promise<Response>;

const CATEGORY_HANDLERS: Record<CategoryKey, GenerateRouteHandler> = {
  "fdp-attended": postFdpAttendedPdf,
  "fdp-conducted": postFdpConductedPdf,
  "case-studies": postCaseStudiesPdf,
  "guest-lectures": postGuestLecturesPdf,
  workshops: postWorkshopsPdf,
};

export async function POST(request: Request, context: { params: Promise<{ category: string; id: string }> }) {
  try {
    const { category, id } = await context.params;
    const normalizedCategory = String(category ?? "").trim();
    if (!isValidCategorySlug(normalizedCategory)) {
      return NextResponse.json({ error: "Unsupported category" }, { status: 404 });
    }

    enforceRateLimitForRequest({
      request,
      action: `entry.generate.direct.${normalizedCategory}`,
      options: RATE_LIMIT_PRESETS.entryMutations,
    });

    const handler = CATEGORY_HANDLERS[normalizedCategory];
    if (!handler) {
      return NextResponse.json({ error: "Unsupported category" }, { status: 404 });
    }

    return handler(request, { params: Promise.resolve({ id: String(id ?? "").trim() }) });
  } catch (error) {
    const appError = normalizeError(error);
    if (appError.code === "RATE_LIMITED") {
      return NextResponse.json({ error: appError.message, code: appError.code }, { status: 429 });
    }
    return NextResponse.json({ error: appError.message || "Generate failed." }, { status: 400 });
  }
}
