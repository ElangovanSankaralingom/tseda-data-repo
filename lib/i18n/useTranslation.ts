"use client";

import { useCallback } from "react";
import {
  t as translate,
  fieldLabel as resolveFieldLabel,
  valueLabel as resolveValueLabel,
  categoryLabel as resolveCategoryLabel,
  type TranslationKey,
  type Language,
} from "./index";
import { useTheme } from "@/lib/theme/ThemeProvider";

export function useTranslation() {
  const { language } = useTheme();

  const t = useCallback(
    (key: TranslationKey) => translate(key, language),
    [language],
  );

  const fieldLabel = useCallback(
    (fieldName: string) => resolveFieldLabel(fieldName, language),
    [language],
  );

  const valueLabel = useCallback(
    (value: string) => resolveValueLabel(value, language),
    [language],
  );

  const categoryLabel = useCallback(
    (slug: string) => resolveCategoryLabel(slug, language),
    [language],
  );

  return { t, fieldLabel, valueLabel, categoryLabel, language };
}
