import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import {
  assertCronSecret,
  runNightlyMaintenance,
} from "@/lib/jobs/nightly";
import { normalizeError, toUserMessage } from "@/lib/errors";

async function handleNightlyCron(request: Request) {
  const startedAt = Date.now();
  try {
    assertCronSecret(request.headers.get("x-cron-secret"));

    const maintenanceResult = await runNightlyMaintenance();
    if (!maintenanceResult.ok) {
      const error = maintenanceResult.error;
      logger.warn({
        event: "jobs.cron.nightly.failed",
        errorCode: error.code,
        durationMs: Date.now() - startedAt,
      });
      return NextResponse.json(
        { ok: false, error: toUserMessage(error), code: error.code },
        { status: 500 }
      );
    }

    logger.info({
      event: "jobs.cron.nightly.success",
      durationMs: Date.now() - startedAt,
      status: maintenanceResult.data.overallSuccess ? "success" : "partial_failure",
    });
    return NextResponse.json(
      { ok: true, data: maintenanceResult.data },
      { status: 200 }
    );
  } catch (error) {
    const normalized = normalizeError(error);
    const status = normalized.code === "UNAUTHORIZED" ? 401 : 500;
    logger.warn({
      event: "jobs.cron.nightly.rejected",
      errorCode: normalized.code,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { ok: false, error: toUserMessage(normalized), code: normalized.code },
      { status }
    );
  }
}

export async function GET(request: Request) {
  return handleNightlyCron(request);
}

export async function POST(request: Request) {
  return handleNightlyCron(request);
}
