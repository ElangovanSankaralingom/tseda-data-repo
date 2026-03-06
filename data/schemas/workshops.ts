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
  { key: "eventName", label: "Event Name", kind: "string" },
  { key: "speakerName", label: "Speaker Name", kind: "string" },
  { key: "organisationName", label: "Organisation Name", kind: "string" },
  { key: "coordinator", label: "Coordinator", kind: "object" },
  { key: "coCoordinators", label: "Co-Coordinators", kind: "array" },
  { key: "participants", label: "Participants", kind: "number" },
  { key: "uploads", label: "Uploads", kind: "object" },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object" },
  { key: "streak", label: "Streak", kind: "object" },
] as const;

export const workshopsSchema: EntrySchema = {
  category: "workshops",
  fields,
  immutableWhenPending: [
    "academicYear",
    "semesterType",
    "startDate",
    "endDate",
    "eventName",
    "speakerName",
    "organisationName",
    "coordinator",
    "coCoordinators",
    "participants",
  ],
  requiredForCommit: [
    "academicYear",
    "semesterType",
    "startDate",
    "endDate",
    "eventName",
    "speakerName",
    "organisationName",
    "uploads.permissionLetter",
    "uploads.brochure",
    "uploads.attendance",
    "uploads.organiserProfile",
    "uploads.geotaggedPhotos",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
