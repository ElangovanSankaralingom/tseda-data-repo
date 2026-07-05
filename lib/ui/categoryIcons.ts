/**
 * Maps category icon string names (from categoryRegistry) to Lucide icon components.
 *
 * Import this in client components that need to render category icons.
 * The icon names match the `icon` field in CategoryConfig.
 * KEEP IN SYNC with the registry — an unmapped name silently falls back to
 * the default document icon (tests/schemas/schemaInvariants.test.ts guards).
 */
import { createElement } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  FileSearch,
  FileText,
  Library,
  Megaphone,
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
  megaphone: Megaphone,
  library: Library,
};

const DEFAULT_ICON: LucideIcon = FileText;

/** Exposed for the registry↔icon-map invariant test. */
export function hasCategoryIcon(iconName: string): boolean {
  return iconName in ICON_MAP;
}

export function getCategoryIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? DEFAULT_ICON;
}

/**
 * Renders a category icon by name. Use this instead of calling getCategoryIcon()
 * directly in render to satisfy the React Compiler's static-components rule.
 */
export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  return createElement(ICON_MAP[name] ?? DEFAULT_ICON, { className });
}
