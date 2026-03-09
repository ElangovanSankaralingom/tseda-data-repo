import { validateByFieldDefinitions } from "@/data/schemas/common";
import type { EntrySchema } from "@/data/schemas/types";
import { YEAR_OF_STUDY_VALUES } from "@/lib/types/academicProgression";

const fields = [
  { key: "id", label: "Entry ID", kind: "string", required: true, exportable: false },
  { key: "academicYear", label: "Academic Year", kind: "string" },
  { key: "startDate", label: "Start Date", kind: "date" },
  { key: "endDate", label: "End Date", kind: "date" },
  { key: "eventName", label: "Event Name", kind: "string" },
  { key: "speakerName", label: "Speaker Name", kind: "string" },
  { key: "organizationName", label: "Organization Name", kind: "string" },
  { key: "coordinator", label: "Coordinator", kind: "object" },
  { key: "coCoordinators", label: "Co-Coordinators", kind: "array" },
  { key: "yearOfStudy", label: "Year of Study", kind: "string", enumValues: YEAR_OF_STUDY_VALUES },
  { key: "currentSemester", label: "Current Semester", kind: "number", min: 1, max: 10 },
  { key: "participants", label: "Participants", kind: "number" },
  { key: "uploads", label: "Uploads", kind: "object", upload: true, stage: 2 },
  { key: "pdfMeta", label: "PDF Metadata", kind: "object", exportable: false },
  { key: "streak", label: "Streak", kind: "object", exportable: false },
] as const;

export const guestLecturesSchema: EntrySchema = {
  category: "guest-lectures",
  fields,
  immutableWhenPending: [
    "academicYear",
    "startDate",
    "endDate",
    "eventName",
    "speakerName",
    "organizationName",
    "coordinator",
    "coCoordinators",
    "yearOfStudy",
    "currentSemester",
    "participants",
  ],
  requiredForCommit: [
    "academicYear",
    "startDate",
    "endDate",
    "eventName",
    "speakerName",
    "organizationName",
    "yearOfStudy",
    "currentSemester",
  ],
  validate(payload, mode) {
    return validateByFieldDefinitions(payload, mode, fields);
  },
};
