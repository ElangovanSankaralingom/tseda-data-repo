export function canSaveEntryDraft(args: {
  dirty: boolean;
  isComplete: boolean;
  isLocked: boolean;
  hasPendingUploads?: boolean;
  hasBusyUploads?: boolean;
}) {
  return (
    args.dirty &&
    !args.isComplete &&
    !args.isLocked &&
    !args.hasPendingUploads &&
    !args.hasBusyUploads
  );
}

export function canDoneEntry(args: { isComplete: boolean; isLocked: boolean }) {
  return args.isComplete && !args.isLocked;
}

export function canGenerateEntry(args: {
  fieldsGateOk: boolean;
  isLocked: boolean;
  hasPdf: boolean;
  pdfStale: boolean;
}) {
  if (!args.fieldsGateOk || args.isLocked) return false;
  return !args.hasPdf || args.pdfStale;
}
