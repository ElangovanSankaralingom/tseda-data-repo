import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type Footer as FooterType,
} from "docx";
import { Footer, HeadingLevel } from "docx";
import { AWARD_SECTIONS, AWARD_METRICS, type AwardSectionId } from "@/data/awardMetrics";
import {
  computeFacultyAwardScore,
  listCommittedEntriesForYear,
} from "@/lib/awards/scoring";
import { readResearchProfile } from "@/lib/research/researchProfile";
import { academicYearOfDate } from "@/lib/utils/academicYear";
import { resolveFacultyName } from "@/lib/admin/facultyRegistry";
import { isDemoContext } from "@/lib/demo/universe";
import type { CategoryKey } from "@/lib/entries/types";

/**
 * FACULTY AWARD APPRAISAL REPORT (Elan's one-click button, 2026-07):
 * generates the submission-ready .docx for one faculty + academic year —
 * every award metric as its own table, filled from the SAME committed
 * entries and research profile the scoring engine reads (via
 * listCommittedEntriesForYear — report and score cannot drift), with the
 * section/total score summary and blank signature blocks.
 *
 * Layout follows the T'SEDA seven-section scheme; each metric table carries
 * the fields the official 18-table format asks for. Metrics with no
 * qualifying items print a "Nil" row (official-form convention); claim /
 * interview metrics state how they are assessed.
 */

type EntryRecord = Record<string, unknown>;

export type AppraisalMetricBlock = {
  id: string;
  label: string;
  source: string;
  points: number;
  count: number;
  notes: string[];
  columns: string[];
  rows: string[][];
  assessmentNote?: string;
};

export type AppraisalModel = {
  facultyName: string;
  email: string;
  academicYear: string;
  generatedAtISO: string;
  totalPoints: number;
  sections: Array<{
    id: AwardSectionId;
    label: string;
    points: number;
    metrics: AppraisalMetricBlock[];
  }>;
};

const s = (entry: EntryRecord, key: string) => String(entry[key] ?? "").trim();
const n = (entry: EntryRecord, key: string) => {
  const value = Number(entry[key]);
  return Number.isFinite(value) ? String(value) : "";
};

type RowBuilder = {
  columns: string[];
  rows: (entries: Map<CategoryKey, EntryRecord[]>) => string[][];
};

/** Per-metric detail columns + rows — mirrors the scoring derivers. */
const ROW_BUILDERS: Record<string, RowBuilder> = {
  collab_workshop: {
    columns: ["Workshop", "Level", "Dates", "Resource Person"],
    rows: (e) => (e.get("workshops") ?? []).map((x) => [
      s(x, "workshopName"), s(x, "level"), `${s(x, "startDate")} – ${s(x, "endDate")}`, s(x, "resourcePersonName"),
    ]),
  },
  collab_guest_lecture: {
    columns: ["Topic", "Level", "Speaker", "Date"],
    rows: (e) => (e.get("guest-lectures") ?? []).map((x) => [
      s(x, "topicOfLecture"), s(x, "level"), s(x, "guestSpeakerName"), s(x, "startDate") || s(x, "endDate"),
    ]),
  },
  fdp_conducted: {
    columns: ["Programme", "Dates", "Participants"],
    rows: (e) => (e.get("fdp-conducted") ?? []).map((x) => [
      s(x, "programName"), `${s(x, "startDate")} – ${s(x, "endDate")}`, n(x, "numberOfParticipants"),
    ]),
  },
  journal_publication: {
    columns: ["Title of Paper", "Journal", "ISSN", "Indexing", "Date", "DOI"],
    rows: (e) => (e.get("journal-publications") ?? []).map((x) => [
      s(x, "paperTitle"), s(x, "journalName"), s(x, "issn"), s(x, "indexing"), s(x, "publicationDate"), s(x, "doi"),
    ]),
  },
  conference_publication: {
    columns: ["Title of Paper", "Conference", "Level", "Indexing", "Date"],
    rows: (e) => (e.get("conference-publications") ?? []).map((x) => [
      s(x, "paperTitle"), s(x, "conferenceName"), s(x, "level"), s(x, "indexing"), s(x, "publicationDate"),
    ]),
  },
  book_publication: {
    columns: ["Title of Book", "Publisher", "ISBN", "Date"],
    rows: (e) => (e.get("books-and-chapters") ?? []).filter((x) => s(x, "kind") === "Book").map((x) => [
      s(x, "bookTitle"), s(x, "publisher"), s(x, "isbn"), s(x, "publicationDate"),
    ]),
  },
  book_chapter: {
    columns: ["Chapter", "Book", "Publisher", "ISBN", "Date"],
    rows: (e) => (e.get("books-and-chapters") ?? []).filter((x) => s(x, "kind") === "Chapter").map((x) => [
      s(x, "chapterTitle"), s(x, "bookTitle"), s(x, "publisher"), s(x, "isbn"), s(x, "publicationDate"),
    ]),
  },
  editorial_role: {
    columns: ["Journal", "Role", "Appointment Date"],
    rows: (e) => (e.get("editorial-roles") ?? []).map((x) => [
      s(x, "journalName"), s(x, "role"), s(x, "appointmentDate"),
    ]),
  },
  utility_patent: {
    columns: ["Title", "Application No.", "Status", "Level", "Date"],
    rows: (e) => (e.get("patents") ?? []).map((x) => [
      s(x, "patentTitle"), s(x, "applicationNumber"), s(x, "status"), s(x, "level"), s(x, "statusDate"),
    ]),
  },
  rd_funding: {
    columns: ["Project", "Agency", "Amount (INR)", "Sanction Date"],
    rows: (e) => (e.get("research-funding") ?? []).filter((x) => s(x, "kind") === "R&D").map((x) => [
      s(x, "projectTitle"), s(x, "agencyOrClient"), n(x, "amountInr"), s(x, "sanctionDate"),
    ]),
  },
  non_rd_funding: {
    columns: ["Project / Work", "Agency / Client", "Kind", "Amount (INR)", "Date"],
    rows: (e) => (e.get("research-funding") ?? []).filter((x) => s(x, "kind") !== "R&D").map((x) => [
      s(x, "projectTitle"), s(x, "agencyOrClient"), s(x, "kind"), n(x, "amountInr"), s(x, "sanctionDate"),
    ]),
  },
  intl_conference_organized: {
    columns: ["Conference", "Role", "Dates"],
    rows: (e) => (e.get("conferences-organized") ?? []).filter((x) => s(x, "level") === "International").map((x) => [
      s(x, "conferenceTitle"), s(x, "role"), `${s(x, "startDate")} – ${s(x, "endDate")}`,
    ]),
  },
  natl_conference_organized: {
    columns: ["Conference", "Role", "Dates"],
    rows: (e) => (e.get("conferences-organized") ?? []).filter((x) => s(x, "level") === "National").map((x) => [
      s(x, "conferenceTitle"), s(x, "role"), `${s(x, "startDate")} – ${s(x, "endDate")}`,
    ]),
  },
};

const SOURCE_ASSESSMENT_NOTE: Record<string, string> = {
  claim: "Not yet tracked in the repository — to be claimed with proofs.",
  interview: "Assessed by the department committee / interview.",
};

/** The data behind the document — exported for tests. */
export async function buildAppraisalModel(
  email: string,
  academicYear: string,
): Promise<AppraisalModel> {
  const [score, entries, research] = await Promise.all([
    computeFacultyAwardScore(email, academicYear),
    listCommittedEntriesForYear(email, academicYear),
    readResearchProfile(email),
  ]);

  const scoreById = new Map(score.metrics.map((m) => [m.id, m]));

  const sections = (Object.keys(AWARD_SECTIONS) as AwardSectionId[])
    .sort((a, b) => AWARD_SECTIONS[a].order - AWARD_SECTIONS[b].order)
    .map((sectionId) => {
      const metrics = AWARD_METRICS.filter((m) => m.section === sectionId).map((metric): AppraisalMetricBlock => {
        const scored = scoreById.get(metric.id);
        const base = {
          id: metric.id,
          label: metric.label,
          source: metric.source,
          points: scored?.points ?? 0,
          count: scored?.count ?? 0,
          notes: scored?.notes ?? [],
        };

        // Profile-sourced Ph.D. metrics read the research profile.
        if (metric.id === "phd_awarded") {
          const own = research.ownPhd;
          const qualifies = own.status === "Awarded" && academicYearOfDate(own.vivaDate) === academicYear;
          return {
            ...base,
            columns: ["University", "Thesis", "Supervisor", "Viva Date"],
            rows: qualifies
              ? [[own.university, own.thesisTitle, own.supervisorName, own.vivaDate]]
              : [],
          };
        }
        if (metric.id === "phd_guided") {
          return {
            ...base,
            columns: ["Scholar", "Thesis", "University", "Viva Date"],
            rows: research.guidedScholars
              .filter((scholar) => academicYearOfDate(scholar.vivaDate) === academicYear)
              .map((scholar) => [scholar.scholarName, scholar.thesisTitle, scholar.university, scholar.vivaDate]),
          };
        }

        const builder = ROW_BUILDERS[metric.id];
        if (builder && (metric.source === "entry")) {
          return { ...base, columns: builder.columns, rows: builder.rows(entries) };
        }

        return {
          ...base,
          columns: ["Particulars"],
          rows: [],
          assessmentNote: SOURCE_ASSESSMENT_NOTE[metric.source],
        };
      });

      return {
        id: sectionId,
        label: AWARD_SECTIONS[sectionId].label,
        points: score.sections.find((sec) => sec.section === sectionId)?.points ?? 0,
        metrics,
      };
    });

  return {
    facultyName: resolveFacultyName(email) || email,
    email,
    academicYear,
    generatedAtISO: new Date().toISOString(),
    totalPoints: score.totalPoints,
    sections,
  };
}

// ── docx rendering ──────────────────────────────────────────────────────────

const CONTENT = 9026; // A4, 1" margins
const border = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

function cell(text: string, width: number, opts: { header?: boolean; bold?: boolean } = {}) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.header ? { fill: "1E3A5F", type: ShadingType.CLEAR } : undefined,
    margins: cellMargins,
    children: [new Paragraph({
      children: [new TextRun({
        text: text || "—",
        size: 18,
        bold: opts.header || opts.bold,
        color: opts.header ? "FFFFFF" : undefined,
      })],
    })],
  });
}

function widthsFor(count: number): number[] {
  const each = Math.floor(CONTENT / count);
  const widths = new Array<number>(count).fill(each);
  widths[count - 1] = CONTENT - each * (count - 1);
  return widths;
}

function metricTable(block: AppraisalMetricBlock): Table {
  const columns = [...block.columns, "Points"];
  const widths = widthsFor(columns.length);
  const dataRows =
    block.rows.length > 0
      ? block.rows.map((row, index) =>
          new TableRow({
            children: [
              ...row.map((value, i) => cell(value, widths[i])),
              cell(index === 0 ? String(block.points) : "", widths[columns.length - 1]),
            ],
          }),
        )
      : [new TableRow({
          children: [
            cell(block.assessmentNote ?? "Nil", CONTENT - widths[columns.length - 1]),
            cell(String(block.points), widths[columns.length - 1]),
          ],
        })];

  return new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: columns.map((column, i) => cell(column, widths[i], { header: true })),
      }),
      ...dataRows,
    ],
  });
}

export async function renderAppraisalDocx(model: AppraisalModel): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun("Individual Faculty Award — Appraisal")],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: "Thiagarajar School of Environmental Design and Architecture (T’SEDA), TCE Madurai", size: 20 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({
        text: `${model.facultyName}  ·  ${model.email}  ·  ${model.academicYear}${isDemoContext() ? "  ·  DEMO — NOT A RECORD" : ""}`,
        size: 20,
        bold: true,
      })],
    }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Score Summary")] }),
    new Table({
      width: { size: CONTENT, type: WidthType.DXA },
      columnWidths: [7026, 2000],
      rows: [
        new TableRow({
          tableHeader: true,
          children: [cell("Section", 7026, { header: true }), cell("Points", 2000, { header: true })],
        }),
        ...model.sections.map((section) =>
          new TableRow({ children: [cell(section.label, 7026), cell(String(section.points), 2000)] }),
        ),
        new TableRow({
          children: [cell("TOTAL", 7026, { bold: true }), cell(String(model.totalPoints), 2000, { bold: true })],
        }),
      ],
    }),
  ];

  for (const section of model.sections) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun(`${section.label} — ${section.points} points`)],
    }));
    for (const metric of section.metrics) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun(metric.label)],
      }));
      children.push(metricTable(metric));
      for (const note of metric.notes) {
        children.push(new Paragraph({
          spacing: { before: 40 },
          children: [new TextRun({ text: `Note: ${note}`, size: 16, italics: true })],
        }));
      }
    }
  }

  // Signature blocks — left blank for the submission.
  children.push(new Paragraph({ spacing: { before: 600 }, children: [] }));
  children.push(new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths: [3009, 3009, 3008],
    rows: [
      new TableRow({
        children: ["Signature of the Faculty", "Head of the Department", "Dean / Chairperson"].map((label, i) =>
          new TableCell({
            borders: { top: border, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
            width: { size: i === 2 ? 3008 : 3009, type: WidthType.DXA },
            margins: { top: 200, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: label, size: 18 })] })],
          }),
        ),
      }),
    ],
  }));

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 20 } } },
      paragraphStyles: [
        { id: "Title", name: "Title", basedOn: "Normal", next: "Normal",
          run: { size: 32, bold: true, font: "Arial", color: "1E3A5F" },
          paragraph: { spacing: { before: 0, after: 80 } } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 24, bold: true, font: "Arial", color: "1E3A5F" },
          paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 20, bold: true, font: "Arial", color: "333333" },
          paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 1 } },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "T’SEDA Data Repository — generated ", size: 14, color: "888888" }),
              new TextRun({ text: model.generatedAtISO.slice(0, 10), size: 14, color: "888888" }),
              new TextRun({ text: "  ·  Page ", size: 14, color: "888888" }),
              new TextRun({ size: 14, color: "888888", children: [PageNumber.CURRENT] }),
            ],
          })],
        }) as FooterType,
      },
      children,
    }],
  });

  return Packer.toBuffer(doc);
}

export async function buildAppraisalDocx(email: string, academicYear: string): Promise<{ buffer: Buffer; fileName: string }> {
  const model = await buildAppraisalModel(email, academicYear);
  const buffer = await renderAppraisalDocx(model);
  const safeName = model.facultyName.replace(/[^a-zA-Z0-9]+/g, "-");
  const yearPart = academicYear.replace(/[^0-9-]+/g, "").replace(/^-+|-+$/g, "");
  return { buffer, fileName: `Award-Appraisal-${yearPart}-${safeName}.docx` };
}
