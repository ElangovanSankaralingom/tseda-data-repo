import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true },
  { key: "academicYear", label: "Academic Year", kind: "string" },
  {
    key: "semesterType",
    label: "Semester Type",
    kind: "string",
    enumValues: ["Odd", "Even", "odd", "even", "ODD", "EVEN"],
  },
  { key: "startDate", label: "Start Date", kind: "date" },
  { key: "endDate", label: "End Date", kind: "date" },
  { key: "programName", label: "Program Name", kind: "string" },
  { key: "organisingBody", label: "Organising Body", kind: "string" },
  { key: "supportAmount", label: "Support Amount", kind: "number" },
  { key: "permissionLetter", label: "Permission Letter", kind: "object" },
  { key: "completionCertificate", label: "Completion Certificate", kind: "object" },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object" },
  { key: "streak", label: "Streak", kind: "object" },
] as const;

export const fdpAttendedSchema: EntrySchema = {
  category: "fdp-attended",
  fields,
  immutableWhenPending: [
    "academicYear",
    "semesterType",
    "startDate",
    "endDate",
    "programName",
    "organisingBody",
    "supportAmount",
  ],
  requiredForCommit: [
    "academicYear",
    "semesterType",
    "startDate",
    "endDate",
    "programName",
    "organisingBody",
    "permissionLetter",
    "completionCertificate",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
