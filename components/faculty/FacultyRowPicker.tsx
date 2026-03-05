"use client";

import { useMemo, useState } from "react";
import FacultySelect, {
  type FacultyOption,
  type FacultySelection,
} from "@/components/controls/FacultySelect";
import { RoleButton } from "@/components/ui/RoleButton";
import { nowISTTimestampISO } from "@/lib/gamification";

export type FacultyRowValue = {
  id?: string;
  name: string;
  email: string;
  isLocked?: boolean;
  savedAtISO?: string | null;
};

type FacultyRowPickerProps = {
  title: string;
  helperText?: string;
  addLabel: string;
  rowLabelPrefix: string;
  rows: FacultyRowValue[];
  onRowsChange: (rows: FacultyRowValue[]) => void;
  onPersistRow: (
    rows: FacultyRowValue[],
    context: {
      row: FacultyRowValue;
      rowId: string;
      index: number;
      previousRows: FacultyRowValue[];
      savedAtISO: string;
    }
  ) => Promise<FacultyRowValue[] | void>;
  facultyOptions: FacultyOption[];
  parentLocked?: boolean;
  viewOnly?: boolean;
  disableEmails?: string[];
  sectionError?: string;
  showSectionError?: boolean;
  emptyStateText?: string;
  validateRow?: (rows: FacultyRowValue[], row: FacultyRowValue, index: number) => string | null;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function uuid() {
  const cryptoApi = globalThis.crypto;

  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function normalizeRows(rows: FacultyRowValue[]) {
  return rows.map((row) => ({
    ...row,
    id: row.id || uuid(),
    name: row.name ?? "",
    email: row.email ?? "",
    isLocked: row.isLocked === true,
    savedAtISO: row.savedAtISO ?? null,
  }));
}

function createEmptyRow(): FacultyRowValue {
  return { id: uuid(), name: "", email: "", isLocked: false, savedAtISO: null };
}

export default function FacultyRowPicker({
  title,
  helperText,
  addLabel,
  rowLabelPrefix,
  rows,
  onRowsChange,
  onPersistRow,
  facultyOptions,
  parentLocked = false,
  viewOnly = false,
  disableEmails = [],
  sectionError,
  showSectionError = false,
  emptyStateText = "No faculty added.",
  validateRow,
}: FacultyRowPickerProps) {
  const [attemptedRowSave, setAttemptedRowSave] = useState<Record<string, boolean>>({});
  const [rowSaveErrors, setRowSaveErrors] = useState<Record<string, string | null>>({});
  const [rowSaving, setRowSaving] = useState<Record<string, boolean>>({});

  const normalizedRows = useMemo(() => normalizeRows(rows), [rows]);
  const normalizedDisabledEmails = useMemo(
    () => disableEmails.map((email) => email.trim().toLowerCase()).filter(Boolean),
    [disableEmails]
  );

  const selectedEmails = useMemo(
    () =>
      normalizedRows
        .map((row) => row.email.trim().toLowerCase())
        .filter(Boolean),
    [normalizedRows]
  );

  function getDisabledEmailsForRow(index: number) {
    const disabled = new Set(normalizedDisabledEmails);
    const currentEmail = normalizedRows[index]?.email?.trim().toLowerCase();

    for (const email of selectedEmails) {
      disabled.add(email);
    }

    if (currentEmail) {
      disabled.delete(currentEmail);
    }

    return disabled;
  }

  function updateRows(updater: (current: FacultyRowValue[]) => FacultyRowValue[]) {
    const nextRows = updater(normalizedRows);
    onRowsChange(normalizeRows(nextRows));
  }

  function handleAddRow() {
    if (viewOnly) return;
    updateRows((current) => [...current, createEmptyRow()]);
  }

  function handleChangeRow(index: number, nextSelection: FacultySelection) {
    if (viewOnly) return;
    const rowId = normalizedRows[index]?.id ?? "";
    updateRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              ...nextSelection,
              id: row.id || rowId || uuid(),
              isLocked: false,
              savedAtISO: null,
            }
          : row
      )
    );
    if (rowId) {
      setAttemptedRowSave((current) => ({ ...current, [rowId]: false }));
      setRowSaveErrors((current) => ({ ...current, [rowId]: null }));
      setRowSaving((current) => ({ ...current, [rowId]: false }));
    }
  }

  function handleDeleteRow(index: number) {
    if (viewOnly) return;
    updateRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  async function handleSaveRow(index: number) {
    if (viewOnly) return;
    const currentRows = normalizeRows(rows);
    const row = currentRows[index];
    const rowId = row?.id ?? "";
    const rowEmail = row?.email?.trim().toLowerCase() ?? "";
    const duplicateCount = currentRows.filter(
      (item, itemIndex) => itemIndex !== index && item.email.trim().toLowerCase() === rowEmail
    ).length;

    setAttemptedRowSave((current) => ({ ...current, [rowId]: true }));

    let error: string | null = null;
    if (!rowEmail) {
      error = "Select a faculty member first.";
    } else if (!facultyOptions.some((option) => option.email.trim().toLowerCase() === rowEmail)) {
      error = "Select a faculty member from the list.";
    } else if (duplicateCount > 0) {
      error = "This faculty is already selected in another row.";
    } else if (validateRow) {
      error = validateRow(currentRows, row, index);
    }

    if (error) {
      setRowSaveErrors((current) => ({ ...current, [rowId]: error }));
      return;
    }

    const savedAtISO = nowISTTimestampISO();
    const optimisticRows = currentRows.map((item, itemIndex) =>
      itemIndex === index
        ? {
            ...item,
            email: item.email.trim().toLowerCase(),
            isLocked: true,
            savedAtISO: item.savedAtISO ?? savedAtISO,
          }
        : item
    );

    onRowsChange(optimisticRows);
    setRowSaveErrors((current) => ({ ...current, [rowId]: null }));
    setRowSaving((current) => ({ ...current, [rowId]: true }));

    try {
      const persistedRows = await onPersistRow(optimisticRows, {
        row: optimisticRows[index],
        rowId,
        index,
        previousRows: currentRows,
        savedAtISO,
      });

      if (persistedRows) {
        onRowsChange(normalizeRows(persistedRows));
      }
      setRowSaveErrors((current) => ({ ...current, [rowId]: null }));
    } catch (error) {
      onRowsChange(currentRows);
      const message = error instanceof Error ? error.message : "Save failed.";
      setRowSaveErrors((current) => ({ ...current, [rowId]: message }));
    } finally {
      setRowSaving((current) => ({ ...current, [rowId]: false }));
    }
  }

  const hasUnlockedSelection = normalizedRows.some((row) => row.email.trim() && !row.isLocked);

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          {helperText ? <div className="mt-1 text-xs text-muted-foreground">{helperText}</div> : null}
        </div>
        {!viewOnly ? (
          <RoleButton role="context" onClick={handleAddRow} disabled={parentLocked}>
            {addLabel}
          </RoleButton>
        ) : null}
      </div>

      {showSectionError && sectionError ? <div className="mt-2 text-xs text-red-600">{sectionError}</div> : null}

      {normalizedRows.length > 0 ? (
        <div className="mt-4 space-y-3">
          {normalizedRows.map((row, index) => {
            const rowId = row.id ?? `${index}`;
            const rowEmail = row.email.trim().toLowerCase();
            const duplicateCount = normalizedRows.filter(
              (item, itemIndex) => itemIndex !== index && item.email.trim().toLowerCase() === rowEmail
            ).length;
            const isSaving = !!rowSaving[rowId];
            const isSaved = !!row.isLocked;
            const saveDisabled = parentLocked || !rowEmail || isSaving || isSaved || duplicateCount > 0;
            const deleteDisabled = parentLocked || viewOnly;

            return (
              <div
                key={rowId}
                className={cx(
                  "grid gap-2 rounded-xl px-3 py-2",
                  viewOnly ? "sm:grid-cols-[1fr]" : "sm:grid-cols-[1fr_auto_auto] sm:items-end",
                  row.isLocked && "bg-muted/30 opacity-70"
                )}
              >
                <div>
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <label className="text-sm font-medium">{`${rowLabelPrefix} ${index + 1}`}</label>
                    </div>
                    <FacultySelect
                      value={row}
                      onChange={(next) => handleChangeRow(index, next)}
                      options={facultyOptions}
                      disabledEmails={getDisabledEmailsForRow(index)}
                      placeholder={`Search or type ${rowLabelPrefix.toLowerCase()}`}
                      disabled={viewOnly || parentLocked || !!row.isLocked}
                      error={attemptedRowSave[rowId] && !!rowSaveErrors[rowId]}
                    />
                  </div>
                </div>

                {!viewOnly ? (
                  <>
                    <RoleButton role="context" onClick={() => void handleSaveRow(index)} disabled={saveDisabled}>
                      {isSaving ? "Saving..." : isSaved ? "Saved" : "Save"}
                    </RoleButton>

                    <RoleButton
                      role="destructive"
                      onClick={() => handleDeleteRow(index)}
                      disabled={deleteDisabled}
                    >
                      Delete
                    </RoleButton>
                  </>
                ) : null}

                {attemptedRowSave[rowId] && rowSaveErrors[rowId] ? (
                  <div className="sm:col-span-3 text-xs text-red-600">{rowSaveErrors[rowId]}</div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 text-sm text-muted-foreground">{emptyStateText}</div>
      )}

      {hasUnlockedSelection ? (
        <div className="mt-3 text-xs text-muted-foreground">Save selected faculty rows to lock them.</div>
      ) : null}
    </div>
  );
}
