function isISODateTime(value: string) {
  return !Number.isNaN(Date.parse(value));
}

export function isWithinRequestEditWindow(
  requestedAtISO: string | null | undefined,
  windowMinutes = 5
) {
  if (!requestedAtISO || !isISODateTime(requestedAtISO)) return false;

  const diffMs = Date.now() - new Date(requestedAtISO).getTime();
  return diffMs >= 0 && diffMs <= windowMinutes * 60 * 1000;
}
