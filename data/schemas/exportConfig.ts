import type { SchemaExportFormatter, SchemaFieldKind } from "@/data/schemas/types";

export type SchemaExportFieldDefinition = {
  key: string;
  label: string;
  kind: SchemaFieldKind;
  exportOrder: number;
  exportFormatter: SchemaExportFormatter;
};

// Canonical cross-category export columns.
// Category-specific columns must come from schema field definitions.
export const BASE_EXPORT_FIELD_DEFS: readonly SchemaExportFieldDefinition[] = [
  {
    key: "category",
    label: "Category",
    kind: "string",
    exportOrder: 10,
    exportFormatter: "auto",
  },
  {
    key: "id",
    label: "Entry ID",
    kind: "string",
    exportOrder: 20,
    exportFormatter: "auto",
  },
  {
    key: "confirmationStatus",
    label: "Confirmation Status",
    kind: "string",
    exportOrder: 30,
    exportFormatter: "status",
  },
  {
    key: "createdAt",
    label: "Created At",
    kind: "string",
    exportOrder: 40,
    exportFormatter: "datetime",
  },
  {
    key: "updatedAt",
    label: "Updated At",
    kind: "string",
    exportOrder: 50,
    exportFormatter: "datetime",
  },
] as const;
