import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true },
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "semesterType", label: "Semester Type", kind: "string" },
  { key: "startDate", label: "Start Date", kind: "date" },
  { key: "endDate", label: "End Date", kind: "date" },
  { key: "eventName", label: "Event Name", kind: "string" },
  { key: "coordinatorName", label: "Coordinator Name", kind: "string" },
  { key: "coordinatorEmail", label: "Coordinator Email", kind: "string" },
  { key: "coCoordinators", label: "Co-Coordinators", kind: "array" },
  { key: "permissionLetter", label: "Permission Letter", kind: "object" },
  { key: "geotaggedPhotos", label: "Geotagged Photos", kind: "array" },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object" },
  { key: "streak", label: "Streak", kind: "object" },
] as const;

export const fdpConductedSchema: EntrySchema = {
  category: "fdp-conducted",
  fields,
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
