import type { CategoryKey } from "@/lib/entries/types";

export type SchemaValidationMode = "create" | "update";

export type SchemaFieldKind =
  | "string"
  | "number"
  | "date"
  | "array"
  | "object"
  | "boolean"
  | "unknown";

export type SchemaFieldDefinition = {
  key: string;
  label: string;
  kind: SchemaFieldKind;
  required?: boolean;
};

export type SchemaValidationError = {
  field: string;
  message: string;
};

export type EntrySchema = {
  category: CategoryKey;
  fields: readonly SchemaFieldDefinition[];
  immutableWhenPending?: readonly string[];
  requiredForCommit?: readonly string[];
  minAttachmentsForCommit?: number;
  validate: (
    payload: Record<string, unknown>,
    mode: SchemaValidationMode
  ) => SchemaValidationError[];
};
