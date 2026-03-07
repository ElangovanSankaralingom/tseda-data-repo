import type { ExportCategorySelection, ExportFormat, BuildExportOptions } from "@/lib/export/exportService";

export type ExportTemplateConfig = {
  category: ExportCategorySelection;
  format: ExportFormat;
  options: BuildExportOptions;
  allUsers?: boolean;
};

export type ExportTemplate = {
  id: string;
  name: string;
  description: string;
  funSubtitle: string;
  icon: string;
  config: ExportTemplateConfig;
};

function thisMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

function thisMonthEnd() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
}

export function getExportTemplates(): ExportTemplate[] {
  return [
    {
      id: "all-finalized",
      name: "All Finalized Entries",
      description: "Complete export of all finalized entries across all users",
      funSubtitle: "The polished gems. Ready for showtime.",
      icon: "CheckCircle",
      config: {
        category: "all",
        format: "xlsx",
        options: { statuses: ["GENERATED"] },
        allUsers: true,
      },
    },
    {
      id: "category-summary",
      name: "Category-wise Summary",
      description: "All entries across all categories and users",
      funSubtitle: "The bird's eye view of everything.",
      icon: "BarChart3",
      config: {
        category: "all",
        format: "xlsx",
        options: {},
        allUsers: true,
      },
    },
    {
      id: "monthly-report",
      name: "Monthly Activity Report",
      description: "All entries generated or updated this month",
      funSubtitle: "What happened this month, in one file.",
      icon: "Calendar",
      config: {
        category: "all",
        format: "csv",
        options: {
          fromISO: thisMonthStart(),
          toISO: thisMonthEnd(),
        },
        allUsers: true,
      },
    },
    {
      id: "draft-cleanup",
      name: "Stale Drafts Report",
      description: "All draft entries — for cleanup review",
      funSubtitle: "The forgotten ones. Time for spring cleaning.",
      icon: "FileWarning",
      config: {
        category: "all",
        format: "csv",
        options: { statuses: ["DRAFT"] },
        allUsers: true,
      },
    },
  ];
}

export function getTemplateById(id: string): ExportTemplate | null {
  return getExportTemplates().find((t) => t.id === id) ?? null;
}
