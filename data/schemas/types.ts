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

export type SchemaExportFormatter =
  | "auto"
  | "date"
  | "datetime"
  | "status"
  | "boolean_yes_no";

export type SchemaFieldDefinition = {
  key: string;
  label: string;
  kind: SchemaFieldKind;
  required?: boolean;
  /** If true, this field is a file upload and is excluded from mandatory-for-streak checks. */
  upload?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  enumValues?: readonly (string | number | boolean)[];
  exportable?: boolean;
  exportOrder?: number;
  exportFormatter?: SchemaExportFormatter;
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
