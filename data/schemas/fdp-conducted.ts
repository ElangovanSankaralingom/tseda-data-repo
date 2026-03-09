import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";
import { YEAR_OF_STUDY_VALUES } from "@/lib/types/academicProgression";

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true, exportable: false },
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "yearOfStudy", label: "Year of Study", kind: "string", enumValues: YEAR_OF_STUDY_VALUES },
  { key: "currentSemester", label: "Current Semester", kind: "number", min: 1, max: 10 },
  { key: "startDate", label: "Start Date", kind: "date" },
  { key: "endDate", label: "End Date", kind: "date" },
  { key: "eventName", label: "Event Name", kind: "string" },
  { key: "coordinatorName", label: "Coordinator Name", kind: "string" },
  { key: "coordinatorEmail", label: "Coordinator Email", kind: "string" },
  { key: "coCoordinators", label: "Co-Coordinators", kind: "array" },
  { key: "permissionLetter", label: "Permission Letter", kind: "object", upload: true, stage: 2 },
  { key: "geotaggedPhotos", label: "Geotagged Photos", kind: "array", upload: true, stage: 2 },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object", exportable: false },
  { key: "streak", label: "Streak", kind: "object", exportable: false },
] as const;

export const fdpConductedSchema: EntrySchema = {
  category: "fdp-conducted",
  fields,
  immutableWhenPending: [
    "academicYear",
    "yearOfStudy",
    "currentSemester",
    "startDate",
    "endDate",
    "eventName",
    "coordinatorName",
    "coordinatorEmail",
    "coCoordinators",
  ],
  requiredForCommit: [
    "academicYear",
    "yearOfStudy",
    "currentSemester",
    "startDate",
    "endDate",
    "eventName",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
