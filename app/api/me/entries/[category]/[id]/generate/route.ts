import { NextResponse } from "next/server";
import { POST as postCaseStudiesPdf } from "@/app/api/me/case-studies/[id]/pdf/route";
import { POST as postFdpAttendedPdf } from "@/app/api/me/fdp-attended/[id]/pdf/route";
import { POST as postFdpConductedPdf } from "@/app/api/me/fdp-conducted/[id]/pdf/route";
import { POST as postGuestLecturesPdf } from "@/app/api/me/guest-lectures/[id]/pdf/route";
import { POST as postWorkshopsPdf } from "@/app/api/me/workshops/[id]/pdf/route";
import type { CategoryKey } from "@/lib/entries/types";

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
  const { category, id } = await context.params;
  const normalizedCategory = String(category ?? "").trim() as CategoryKey;
  const handler = CATEGORY_HANDLERS[normalizedCategory];

  if (!handler) {
    return NextResponse.json({ error: "Unsupported category" }, { status: 404 });
  }

  return handler(request, { params: Promise.resolve({ id: String(id ?? "").trim() }) });
}
