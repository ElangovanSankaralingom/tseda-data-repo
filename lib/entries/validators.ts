export function canSaveEntryDraft(args: {
  dirty: boolean;
  isComplete: boolean;
  isLocked: boolean;
  hasPendingUploads?: boolean;
  hasBusyUploads?: boolean;
}) {
  void args.isLocked;
  return (
    args.dirty &&
    !args.isComplete &&
    !args.hasPendingUploads &&
    !args.hasBusyUploads
  );
}

export function canDoneEntry(args: { isComplete: boolean; isLocked: boolean }) {
  void args.isLocked;
  return args.isComplete;
}

export function canGenerateEntry(args: {
  fieldsGateOk: boolean;
  isLocked: boolean;
  hasPdf: boolean;
  pdfStale: boolean;
}) {
  if (!args.fieldsGateOk) return false;
  return !args.hasPdf || args.pdfStale;
}
