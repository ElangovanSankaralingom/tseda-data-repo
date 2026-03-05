import type { EntrySchema } from "@/data/schemas/types";
import { caseStudiesSchema } from "@/data/schemas/case-studies";
import { fdpAttendedSchema } from "@/data/schemas/fdp-attended";
import { fdpConductedSchema } from "@/data/schemas/fdp-conducted";
import { guestLecturesSchema } from "@/data/schemas/guest-lectures";
import { workshopsSchema } from "@/data/schemas/workshops";
import type { CategoryKey } from "@/lib/entries/types";

export const ENTRY_SCHEMAS: Record<CategoryKey, EntrySchema> = {
  "fdp-attended": fdpAttendedSchema,
  "fdp-conducted": fdpConductedSchema,
  "case-studies": caseStudiesSchema,
  "guest-lectures": guestLecturesSchema,
  workshops: workshopsSchema,
};

export type { EntrySchema, SchemaValidationError, SchemaValidationMode } from "@/data/schemas/types";
