import "server-only";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getCategoryConfig, getCategorySchema, isValidCategorySlug } from "@/data/categoryRegistry";
import { authOptions } from "@/lib/auth";
import { listEntriesForCategory } from "@/lib/entries/lifecycle";
import { getEditTimeRemaining, isEntryEditable, isEntryFinalized, normalizeEntryStatus } from "@/lib/entries/workflow";
import type { EntryStateLike } from "@/lib/entries/workflow";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { isEntryActivated, isEntryWon } from "@/lib/streakProgress";
import type { StreakProgressEntryLike } from "@/lib/streakProgress";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ category: string }> },
) {
  const { category } = await params;

  if (!isValidCategorySlug(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = getCategoryConfig(category);
  const schema = getCategorySchema(category);
  const userFields = schema.fields.filter((f) => f.exportable !== false);

  const entries = await listEntriesForCategory(email, category);

  let drafts = 0;
  let editable = 0;
  let expiringSoon = 0;
  let finalized = 0;
  let editRequested = 0;
  let editGranted = 0;
  let streakActive = 0;
  let streakWon = 0;

  const entryDetails = entries.map((entry) => {
    const rec = entry as Record<string, unknown>;
    const stateLike = rec as unknown as EntryStateLike;
    const streakLike = rec as unknown as StreakProgressEntryLike;
    const status = normalizeEntryStatus(stateLike);
    const isEdit = isEntryEditable(stateLike);
    const isFinal = isEntryFinalized(stateLike);
    const editTime = getEditTimeRemaining(stateLike);
    const activated = isEntryActivated(streakLike);
    const won = isEntryWon(streakLike, userFields);
    const streakEligible = rec.streakEligible === true;

    if (status === "DRAFT") drafts++;
    else if (status === "EDIT_REQUESTED") editRequested++;
    else if (status === "EDIT_GRANTED") editGranted++;

    if (isEdit && status !== "DRAFT") editable++;
    if (isFinal) finalized++;
    if (editTime.hasEditWindow && !editTime.expired && editTime.remainingMs < 24 * 60 * 60 * 1000) expiringSoon++;
    if (activated && !won) streakActive++;
    if (won) streakWon++;

    // Field completion
    let fieldsCompleted = 0;
    for (const field of userFields) {
      const parts = field.key.split(".");
      let value: unknown = rec;
      for (const part of parts) {
        if (!value || typeof value !== "object") {
          value = undefined;
          break;
        }
        value = (value as Record<string, unknown>)[part];
      }
      if (value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0)) {
        fieldsCompleted++;
      }
    }

    // Key field preview (first 3 non-empty string fields)
    const keyFields: { label: string; value: string }[] = [];
    for (const f of userFields) {
      if (keyFields.length >= 3) break;
      if (f.key === "id" || f.key === "status") continue;
      const val = rec[f.key];
      if (typeof val === "string" && val.trim()) {
        keyFields.push({ label: f.label, value: val.trim() });
      }
    }

    // Title from configured title field
    const titleField = config.entryTitleField;
    const title = titleField
      ? String(rec[titleField] ?? "").trim() || config.entryTitleFallback || "Untitled"
      : config.entryTitleFallback || "Untitled";

    return {
      id: String(rec.id ?? ""),
      title,
      subtitle: "",
      status,
      streakEligible,
      isEditable: isEdit,
      isFinalized: isFinal,
      isComplete: fieldsCompleted >= userFields.length,
      fieldsCompleted,
      fieldsTotal: userFields.length,
      generatedAt: (rec.committedAtISO as string) ?? null,
      createdAt: String(rec.createdAt ?? ""),
      updatedAt: String(rec.updatedAt ?? ""),
      editWindowExpiry: (rec.editWindowExpiresAt as string) ?? null,
      remainingTime:
        editTime.hasEditWindow && !editTime.expired
          ? {
              days: Math.floor(editTime.remainingMs / (24 * 60 * 60 * 1000)),
              hours: Math.floor((editTime.remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)),
            }
          : null,
      editRequestedAt: (rec.editRequestedAt as string) ?? null,
      editGrantedAt: (rec.editGrantedAt as string) ?? null,
      keyFields,
    };
  });

  const total = entries.length;
  const completionRate = total > 0 ? Math.round((finalized / total) * 100) : 0;

  return NextResponse.json({
    data: {
      category: {
        slug: category,
        name: config.label,
        description: config.subtitle ?? "",
        icon: config.icon ?? "",
        fieldCount: userFields.length,
      },
      stats: {
        total,
        drafts,
        editable,
        expiringSoon,
        finalized,
        editRequested,
        editGranted,
        streakActive,
        streakWon,
        completionRate,
      },
      entries: entryDetails,
    },
  });
}
