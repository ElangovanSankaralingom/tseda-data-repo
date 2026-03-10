/**
 * Maps category icon string names (from categoryRegistry) to Lucide icon components.
 *
 * Import this in client components that need to render category icons.
 * The icon names match the `icon` field in CategoryConfig.
 */
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  FileSearch,
  FileText,
  Mic,
  Presentation,
  Wrench,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  presentation: Presentation,
  "clipboard-list": FileSearch,
  mic: Mic,
  hammer: Wrench,
};

const DEFAULT_ICON: LucideIcon = FileText;

export function getCategoryIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? DEFAULT_ICON;
}
