import { en, type TranslationDict } from "./en";
import { ta } from "./ta";

export type Language = "en" | "ta";

const dictionaries: Record<Language, TranslationDict> = { en, ta };

// Recursive dot-path type generator
type PathsOf<T, P extends string = ""> = T extends string
  ? P
  : {
      [K in keyof T & string]: PathsOf<
        T[K],
        P extends "" ? K : `${P}.${K}`
      >;
    }[keyof T & string];

export type TranslationKey = PathsOf<TranslationDict>;

function resolve(dict: TranslationDict, key: string): string {
  const parts = key.split(".");
  let current: unknown = dict;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  return typeof current === "string" ? current : key;
}

export function t(key: TranslationKey, language: Language): string {
  const result = resolve(dictionaries[language], key);
  if (result === key && language !== "en") {
    return resolve(dictionaries.en, key);
  }
  return result;
}

export function fieldLabel(fieldName: string, language: Language): string {
  const key = `fields.${fieldName}`;
  const result = resolve(dictionaries[language], key);
  return result === key ? fieldName : result;
}

export function valueLabel(value: string, language: Language): string {
  const key = `values.${value}`;
  const result = resolve(dictionaries[language], key);
  return result === key ? value : result;
}

export function categoryLabel(slug: string, language: Language): string {
  const key = `category.${slug}`;
  const result = resolve(dictionaries[language], key);
  return result === key ? slug : result;
}

export type { TranslationDict } from "./en";
