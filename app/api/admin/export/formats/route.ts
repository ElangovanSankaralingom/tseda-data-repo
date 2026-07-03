import { demoAware } from "@/lib/demo/demoAware";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { canExport } from "@/lib/admin/roles";
import {
  getCoordinatorScope,
  canCoordinatorExport,
} from "@/lib/admin/coordinators";
import {
  listTemplatesForViewer,
  getFormatTemplateById,
  upsertFormatTemplate,
  removeFormatTemplate,
  type ExportFormatTemplate,
} from "@/lib/export/formatTemplates";
import { logError, normalizeError } from "@/lib/errors";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { isCategoryKey } from "@/lib/categories";
import { assertActionPayload, SECURITY_LIMITS } from "@/lib/security/limits";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { csrfGuard } from "@/lib/security/csrf";

/** Anyone who can export something may view the format templates available to them. */
function canSeeFormats(email: string): boolean {
  return canExport(email) || getCoordinatorScope(email).export;
}

async function GETHandler() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!canSeeFormats(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ templates: listTemplatesForViewer(email) });
}

type Body =
  | { action: "upsert"; template: Partial<ExportFormatTemplate> }
  | { action: "remove"; id: string };

async function POSTHandler(request: Request) {
  const csrfBlocked = csrfGuard(request);
  if (csrfBlocked) return csrfBlocked;

  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!canSeeFormats(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    enforceRateLimitForRequest({
      request,
      userEmail: email,
      action: "admin.export.formats.post",
      options: RATE_LIMIT_PRESETS.adminOps,
    });

    const body = (await request.json()) as Body;
    assertActionPayload(body, "export format change", SECURITY_LIMITS.actionPayloadMaxBytes);
    const isGlobal = canExport(email);

    if (body.action === "remove") {
      const id = String(body.id ?? "").trim();
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const existing = getFormatTemplateById(id);
      // Master/export-admin may remove any; a DLC only their own.
      if (existing && !isGlobal && existing.createdBy !== email) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const config = removeFormatTemplate(id);
      return NextResponse.json({ templates: listTemplatesForViewer(email), config });
    }

    if (body.action === "upsert") {
      const input = body.template ?? {};
      const category = String(input.category ?? "");
      // Author scope: global exporters author for any category; a coordinator
      // only for categories they can export.
      if (!isGlobal && !(isCategoryKey(category) && canCoordinatorExport(email, category))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // On edit, preserve original ownership; only the owner or a global exporter
      // may edit an existing template.
      const existing = input.id ? getFormatTemplateById(String(input.id)) : null;
      if (existing && !isGlobal && existing.createdBy !== email) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const ownerScope = existing ? existing.ownerScope : isGlobal ? "master" : "dlc";
      const createdBy = existing ? existing.createdBy : email;

      const config = upsertFormatTemplate({ ...input, ownerScope, createdBy });
      if (!config) {
        return NextResponse.json(
          { error: "A format needs a name, a category, and at least one valid column." },
          { status: 400 }
        );
      }
      return NextResponse.json({ templates: listTemplatesForViewer(email), config });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const appError = normalizeError(error);
    logError(appError, "api.admin.export.formats.POST");
    return NextResponse.json({ error: appError.message || "Error" }, { status: 500 });
  }
}

// Demo-mode universe wrapper — every handler runs in the caller's universe.
export const GET = demoAware(GETHandler);
export const POST = demoAware(POSTHandler);
