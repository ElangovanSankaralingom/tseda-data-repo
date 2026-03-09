import type React from "react";
import type { LucideIcon } from "lucide-react";
import type { CategorySlug } from "@/data/categoryRegistry";
import type { EntryDisplayCategory } from "@/lib/entries/displayLifecycle";
import type { FieldProgress } from "@/lib/entries/fieldProgress";
import type { EditTimeRemaining } from "@/lib/entries/workflow";
import type { EntryListGroup, ListGroupedEntries } from "@/lib/entryCategorization";
import type { EntryStatus } from "@/lib/types/entry";
import type { RequestEditStatus } from "@/lib/types/requestEdit";

export type CategoryOverview = {
  slug: string;
  label: string;
  subtitle: string;
  href: string;
  newHref: string;
  totalEntries: number;
  draftCount: number;
  generatedCount: number;
  editRequestedCount: number;
  editGrantedCount: number;
  streakActivated: number;
  streakWins: number;
  completedNonStreak: number;
  lastActivity: string | null;
};

export type Totals = {
  totalEntries: number;
  draftCount: number;
  generatedCount: number;
  editRequestedCount: number;
  editGrantedCount: number;
  streakActivatedCount: number;
  streakWinsCount: number;
  completedNonStreakCount: number;
};

export type RequestEditControls = {
  locked: boolean;
  status?: RequestEditStatus;
  requestedAtISO?: string | null;
  requesting: boolean;
  onRequest: () => void;
  onCancel: () => void;
};

export type RequestDeleteControls = {
  requesting: boolean;
  onRequest: () => void;
  onCancel: () => void;
};

export type SendForConfirmationControls = {
  disabled: boolean;
  sending: boolean;
  onClick: () => void;
  label?: string;
  pendingLabel?: string;
  sendingLabel?: string;
};

export type DeleteConfirmationRequest = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
};

export type CategoryEntryRenderEntry = {
  id: string;
  status?: string | null;
  confirmationStatus?: EntryStatus | string | null;
  requestEditStatus?: RequestEditStatus;
  requestEditRequestedAtISO?: string | null;
  committedAtISO?: string | null;
  streak?: unknown;
  streakEligible?: boolean;
  editWindowExpiresAt?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  permanentlyLocked?: boolean;
  pdfMeta?: {
    url?: string | null;
  } | null;
};

export type PdfMeta = {
  url?: string | null;
  fileName?: string;
  generatedAtISO?: string;
} | null | undefined;

export type CardContent = {
  title: string;
  subtitle?: string;
  className?: string;
  content: React.ReactNode;
  stats?: ListStats;
};

export type EntryPdfMeta = {
  url: string;
  fileName?: string;
} | null | undefined;

export type SectionConfig = {
  title: string;
  icon: LucideIcon;
  iconColor: string;
  urgentColor?: string;
};

// --- Types moved from GroupedEntrySections.tsx ---

export type ListStats = {
  total: number;
  drafts: number;
  active: number;
  finalized: number;
  pending: number;
  streakActive: number;
};

export type GroupedEntries<TEntry> = {
  draft: TEntry[];
  activated: TEntry[];
  completed: TEntry[];
};

export type GroupedEntryRender<TEntry> = (
  entry: TEntry,
  category: EntryDisplayCategory,
  index: number
) => React.ReactNode;

export type SmartGroupedEntryRender<TEntry> = (
  entry: TEntry,
  group: EntryListGroup,
  index: number
) => React.ReactNode;

export type SmartGroupedEntrySectionsProps<TEntry> = {
  groupedEntries: ListGroupedEntries<TEntry>;
  renderEntry: SmartGroupedEntryRender<TEntry>;
  emptyState?: React.ReactNode;
  searchable?: boolean;
  activeClassName?: string;
};

export type GroupedEntrySectionsProps<TEntry> = {
  groupedEntries: GroupedEntries<TEntry>;
  renderEntry: GroupedEntryRender<TEntry>;
  draftTitle?: string;
  activatedTitle?: string;
  completedTitle?: string;
  emptyState?: React.ReactNode;
};

export type GroupedEntryListCardConfig<TEntry> = {
  title: string;
  subtitle?: string;
  className?: string;
  groupedEntries: ListGroupedEntries<TEntry>;
  renderEntry: SmartGroupedEntryRender<TEntry>;
  emptyState?: React.ReactNode;
};

// --- Props from EditorStatusBanner.tsx ---

export type EditorStatusBannersProps = {
  status?: string | null;
  isEditable: boolean;
  editTimeLabel?: string;
  editTimeMs?: number;
  expiresAtISO?: string | null;
  hasPdf?: boolean;
  permanentlyLocked?: boolean;
  onCancelRequest?: () => void;
};

// --- Props from CategoryEntryRecordCard.tsx ---

export type CategoryEntryRecordCardProps = {
  group: EntryListGroup;
  index: number;
  href: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  metadata?: React.ReactNode;
  confirmationStatus?: EntryStatus | string | null;
  editTime?: EditTimeRemaining;
  createdAt?: string;
  updatedAt?: string;
  hideActions?: boolean;
  onView: () => void;
  onPreview?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  sendForConfirmation?: SendForConfirmationControls;
  requestEdit?: RequestEditControls;
  requestDelete?: RequestDeleteControls;
  permanentlyLocked?: boolean;
  children?: React.ReactNode;
};

export type CategoryEntryRecordRendererOptions<TEntry extends CategoryEntryRenderEntry> = {
  buildHref: (entry: TEntry) => string;
  buildTitle: (entry: TEntry) => React.ReactNode;
  buildSubtitle?: (entry: TEntry) => React.ReactNode;
  renderBody: (entry: TEntry) => React.ReactNode;
  onView: (entry: TEntry) => void;
  onEdit?: (entry: TEntry) => void;
  onPreview?: (entry: TEntry) => void;
  previewUrl?: (entry: TEntry) => string | null | undefined;
  hideActions?: (entry: TEntry, group: EntryListGroup) => boolean;
  enableWorkflowActions?: (entry: TEntry, group: EntryListGroup) => boolean;
  deleteLabel?: string | ((entry: TEntry) => string);
  requestConfirmation?: (request: DeleteConfirmationRequest) => void;
  buildDeleteRequest?: (entry: TEntry) => DeleteConfirmationRequest;
  requestingEditIds: Record<string, boolean | undefined>;
  requestingDeleteIds: Record<string, boolean | undefined>;
  sendingConfirmationIds: Record<string, boolean | undefined>;
  requestEdit: (entry: TEntry) => void | Promise<void>;
  cancelRequestEdit: (entry: TEntry) => void | Promise<void>;
  requestDelete: (entry: TEntry) => void | Promise<void>;
  cancelRequestDelete: (entry: TEntry) => void | Promise<void>;
  sendForConfirmation: (entry: TEntry) => void | Promise<void>;
};

// --- Props from EntryDocumentSection.tsx ---

export type EntryDocumentSectionProps = {
  pdfMeta: PdfMeta;
  pdfStale: boolean;
  canPreview: boolean;
  canDownload: boolean;
  onRegenerate: () => void;
  generating: boolean;
  isViewMode?: boolean;
};

// --- Props from EditorProgressHeader.tsx ---

export type EditorProgressHeaderProps = {
  category: CategorySlug;
  progress: FieldProgress;
  isGenerated: boolean;
  streakEligible?: boolean;
  editTimeLabel?: string;
  showFinalise?: boolean;
  canFinalise?: boolean;
};
