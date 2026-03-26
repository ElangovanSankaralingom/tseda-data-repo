export type ThemeMode = "light" | "dark" | "color";
export type ColorPalette = "ocean-blue" | "forest-green" | "royal-purple" | "sunset-warm" | "rose-pink";

export interface ThemeTokens {
  "--color-primary": string;
  "--color-primary-light": string;
  "--color-primary-muted": string;
  "--color-primary-hover": string;
  "--color-accent": string;
  "--color-accent-light": string;
  "--color-header-bg": string;
  "--color-header-text": string;
  "--color-sidebar-bg": string;
  "--color-sidebar-text": string;
  "--color-sidebar-active-bg": string;
  "--color-sidebar-active-text": string;
  "--color-sidebar-hover-bg": string;
  "--color-body-bg": string;
  "--color-card-bg": string;
  "--color-card-border": string;
  "--color-text-primary": string;
  "--color-text-secondary": string;
  "--color-text-muted": string;
  "--color-input-bg": string;
  "--color-input-border": string;
  "--color-input-focus-ring": string;
  "--color-badge-bg": string;
  "--color-badge-text": string;
  "--color-button-primary-bg": string;
  "--color-button-primary-text": string;
  "--color-button-primary-hover": string;
  "--color-generate-bg": string;
  "--color-generate-hover": string;
  "--color-divider": string;
  "--color-dropdown-bg": string;
  "--color-dropdown-hover": string;
  "--color-toast-bg": string;
  "--color-modal-overlay": string;
  "--color-modal-bg": string;
  "--color-skeleton-base": string;
  "--color-skeleton-shine": string;
}

export const LIGHT_BASE: ThemeTokens = {
  "--color-primary": "#1E3A5F",
  "--color-primary-light": "#2D5F8A",
  "--color-primary-muted": "#E8EEF4",
  "--color-primary-hover": "#16304F",
  "--color-accent": "#10B981",
  "--color-accent-light": "#D1FAE5",
  "--color-header-bg": "#1E3A5F",
  "--color-header-text": "#FFFFFF",
  "--color-sidebar-bg": "#FFFFFF",
  "--color-sidebar-text": "#334155",
  "--color-sidebar-active-bg": "#EFF6FF",
  "--color-sidebar-active-text": "#1E3A5F",
  "--color-sidebar-hover-bg": "#F8FAFC",
  "--color-body-bg": "#F8FAFC",
  "--color-card-bg": "#FFFFFF",
  "--color-card-border": "#E2E8F0",
  "--color-text-primary": "#0F172A",
  "--color-text-secondary": "#475569",
  "--color-text-muted": "#94A3B8",
  "--color-input-bg": "#FFFFFF",
  "--color-input-border": "#CBD5E1",
  "--color-input-focus-ring": "#1E3A5F",
  "--color-badge-bg": "#6366F1",
  "--color-badge-text": "#FFFFFF",
  "--color-button-primary-bg": "#1E3A5F",
  "--color-button-primary-text": "#FFFFFF",
  "--color-button-primary-hover": "#16304F",
  "--color-generate-bg": "#059669",
  "--color-generate-hover": "#047857",
  "--color-divider": "#E2E8F0",
  "--color-dropdown-bg": "#FFFFFF",
  "--color-dropdown-hover": "#F1F5F9",
  "--color-toast-bg": "#FFFFFF",
  "--color-modal-overlay": "rgba(0,0,0,0.2)",
  "--color-modal-bg": "#FFFFFF",
  "--color-skeleton-base": "#E2E8F0",
  "--color-skeleton-shine": "#F1F5F9",
};

export const DARK_BASE: ThemeTokens = {
  "--color-primary": "#3B82F6",
  "--color-primary-light": "#60A5FA",
  "--color-primary-muted": "#1E293B",
  "--color-primary-hover": "#2563EB",
  "--color-accent": "#34D399",
  "--color-accent-light": "#064E3B",
  "--color-header-bg": "#111827",
  "--color-header-text": "#F1F5F9",
  "--color-sidebar-bg": "#1F2937",
  "--color-sidebar-text": "#CBD5E1",
  "--color-sidebar-active-bg": "#374151",
  "--color-sidebar-active-text": "#F1F5F9",
  "--color-sidebar-hover-bg": "#374151",
  "--color-body-bg": "#111827",
  "--color-card-bg": "#1F2937",
  "--color-card-border": "#374151",
  "--color-text-primary": "#F1F5F9",
  "--color-text-secondary": "#CBD5E1",
  "--color-text-muted": "#6B7280",
  "--color-input-bg": "#374151",
  "--color-input-border": "#4B5563",
  "--color-input-focus-ring": "#3B82F6",
  "--color-badge-bg": "#6366F1",
  "--color-badge-text": "#FFFFFF",
  "--color-button-primary-bg": "#3B82F6",
  "--color-button-primary-text": "#FFFFFF",
  "--color-button-primary-hover": "#2563EB",
  "--color-generate-bg": "#10B981",
  "--color-generate-hover": "#059669",
  "--color-divider": "#374151",
  "--color-dropdown-bg": "#1F2937",
  "--color-dropdown-hover": "#374151",
  "--color-toast-bg": "#1F2937",
  "--color-modal-overlay": "rgba(0,0,0,0.5)",
  "--color-modal-bg": "#1F2937",
  "--color-skeleton-base": "#374151",
  "--color-skeleton-shine": "#4B5563",
};

export const COLOR_PALETTES: Record<ColorPalette, Partial<ThemeTokens>> = {
  "ocean-blue": {},
  "forest-green": {
    "--color-primary": "#1B4332",
    "--color-primary-light": "#2D6A4F",
    "--color-primary-muted": "#E8F0EC",
    "--color-primary-hover": "#143528",
    "--color-accent": "#059669",
    "--color-accent-light": "#D1FAE5",
    "--color-header-bg": "#1B4332",
    "--color-sidebar-active-bg": "#ECFDF5",
    "--color-sidebar-active-text": "#1B4332",
    "--color-input-focus-ring": "#1B4332",
    "--color-badge-bg": "#059669",
    "--color-button-primary-bg": "#1B4332",
    "--color-button-primary-hover": "#143528",
    "--color-generate-bg": "#059669",
    "--color-generate-hover": "#047857",
  },
  "royal-purple": {
    "--color-primary": "#4A1D6A",
    "--color-primary-light": "#6B3FA0",
    "--color-primary-muted": "#F0E8F5",
    "--color-primary-hover": "#3A1555",
    "--color-accent": "#8B5CF6",
    "--color-accent-light": "#EDE9FE",
    "--color-header-bg": "#4A1D6A",
    "--color-sidebar-active-bg": "#F5F3FF",
    "--color-sidebar-active-text": "#4A1D6A",
    "--color-input-focus-ring": "#4A1D6A",
    "--color-badge-bg": "#7C3AED",
    "--color-button-primary-bg": "#4A1D6A",
    "--color-button-primary-hover": "#3A1555",
    "--color-generate-bg": "#7C3AED",
    "--color-generate-hover": "#6D28D9",
  },
  "sunset-warm": {
    "--color-primary": "#8B3A14",
    "--color-primary-light": "#B85C38",
    "--color-primary-muted": "#F5EDE8",
    "--color-primary-hover": "#7A3010",
    "--color-accent": "#F59E0B",
    "--color-accent-light": "#FEF3C7",
    "--color-header-bg": "#8B3A14",
    "--color-sidebar-active-bg": "#FFFBEB",
    "--color-sidebar-active-text": "#8B3A14",
    "--color-input-focus-ring": "#8B3A14",
    "--color-badge-bg": "#D97706",
    "--color-button-primary-bg": "#8B3A14",
    "--color-button-primary-hover": "#7A3010",
    "--color-generate-bg": "#D97706",
    "--color-generate-hover": "#B45309",
  },
  "rose-pink": {
    "--color-primary": "#9B1B5E",
    "--color-primary-light": "#C2267A",
    "--color-primary-muted": "#F5E8F0",
    "--color-primary-hover": "#881750",
    "--color-accent": "#EC4899",
    "--color-accent-light": "#FCE7F3",
    "--color-header-bg": "#9B1B5E",
    "--color-sidebar-active-bg": "#FDF2F8",
    "--color-sidebar-active-text": "#9B1B5E",
    "--color-input-focus-ring": "#9B1B5E",
    "--color-badge-bg": "#DB2777",
    "--color-button-primary-bg": "#9B1B5E",
    "--color-button-primary-hover": "#881750",
    "--color-generate-bg": "#DB2777",
    "--color-generate-hover": "#BE185D",
  },
};

export function resolveTokens(mode: ThemeMode, palette: ColorPalette): ThemeTokens {
  if (mode === "dark") return { ...DARK_BASE };
  if (mode === "color") return { ...LIGHT_BASE, ...COLOR_PALETTES[palette] };
  return { ...LIGHT_BASE };
}
