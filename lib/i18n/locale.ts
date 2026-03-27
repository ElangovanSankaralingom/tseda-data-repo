import type { Language } from "./index";

export const LOCALE_MAP: Record<Language, string> = {
  en: "en-IN",
  ta: "ta-IN",
};

export function getLocale(language: Language): string {
  return LOCALE_MAP[language] ?? "en-IN";
}

export function formatDate(
  date: Date | string,
  language: Language,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(
    getLocale(language),
    options ?? { day: "numeric", month: "short", year: "numeric" },
  );
}

export function formatNumber(num: number, language: Language): string {
  return num.toLocaleString(getLocale(language));
}

export function formatCurrency(amount: number, language: Language): string {
  return `\u20B9${amount.toLocaleString(getLocale(language))}`;
}
