export type ThemeMode = "light" | "dark" | "color";
export type ColorPalette = "midnight-lime" | "deep-ocean" | "carbon-violet" | "obsidian-amber";

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
  "--color-text-tertiary": string;
  "--color-text-placeholder": string;
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
  "--color-divider-strong": string;
  "--color-border-subtle": string;
  "--color-border-default": string;
  "--color-border-strong": string;
  "--color-icon-active": string;
  "--color-icon-default": string;
  "--color-icon-muted": string;
  "--color-surface-raised": string;
  "--color-surface-inset": string;
  "--color-dropdown-bg": string;
  "--color-dropdown-hover": string;
  "--color-toast-bg": string;
  "--color-modal-overlay": string;
  "--color-modal-bg": string;
  "--color-skeleton-base": string;
  "--color-skeleton-shine": string;
  "--color-header-tint": string;
  "--color-gradient-from": string;
  "--color-gradient-to": string;
  "--color-glass-bg": string;
  "--color-glass-border": string;
  "--color-glass-hover": string;
  "--color-glow-primary": string;
  "--color-status-success": string;
  "--color-status-success-bg": string;
  "--color-status-success-border": string;
  "--color-status-warning": string;
  "--color-status-warning-bg": string;
  "--color-status-warning-border": string;
  "--color-status-error": string;
  "--color-status-error-bg": string;
  "--color-status-error-border": string;
  "--color-status-info": string;
  "--color-status-info-bg": string;
  "--color-status-info-border": string;
}

/* ─── LIGHT BASE ─── */
export const LIGHT_BASE: ThemeTokens = {
  "--color-primary": "#4D7C0F",
  "--color-primary-light": "#65A30D",
  "--color-primary-muted": "#F0F9E0",
  "--color-primary-hover": "#3F6212",
  "--color-accent": "#84CC16",
  "--color-accent-light": "#ECFCCB",
  "--color-header-bg": "#FFFFFF",
  "--color-header-text": "#0F172A",
  "--color-sidebar-bg": "#FFFFFF",
  "--color-sidebar-text": "#334155",
  "--color-sidebar-active-bg": "#F0F9E0",
  "--color-sidebar-active-text": "#4D7C0F",
  "--color-sidebar-hover-bg": "#F8FAFC",
  "--color-body-bg": "#F8FAFC",
  "--color-card-bg": "#FFFFFF",
  "--color-card-border": "#E2E8F0",
  "--color-text-primary": "#0F172A",
  "--color-text-secondary": "#475569",
  "--color-text-muted": "#94A3B8",
  "--color-text-tertiary": "#94A3B8",
  "--color-text-placeholder": "#94A3B8",
  "--color-input-bg": "#FFFFFF",
  "--color-input-border": "#CBD5E1",
  "--color-input-focus-ring": "#84CC16",
  "--color-badge-bg": "#84CC16",
  "--color-badge-text": "#FFFFFF",
  "--color-button-primary-bg": "#4D7C0F",
  "--color-button-primary-text": "#FFFFFF",
  "--color-button-primary-hover": "#3F6212",
  "--color-generate-bg": "#65A30D",
  "--color-generate-hover": "#4D7C0F",
  "--color-divider": "#E2E8F0",
  "--color-divider-strong": "#CBD5E1",
  "--color-border-subtle": "#F1F5F9",
  "--color-border-default": "#E2E8F0",
  "--color-border-strong": "#CBD5E1",
  "--color-icon-active": "#0F172A",
  "--color-icon-default": "#475569",
  "--color-icon-muted": "#94A3B8",
  "--color-surface-raised": "#FFFFFF",
  "--color-surface-inset": "#F8FAFC",
  "--color-dropdown-bg": "#FFFFFF",
  "--color-dropdown-hover": "#F1F5F9",
  "--color-toast-bg": "#FFFFFF",
  "--color-modal-overlay": "rgba(0,0,0,0.2)",
  "--color-modal-bg": "#FFFFFF",
  "--color-skeleton-base": "#E2E8F0",
  "--color-skeleton-shine": "#F1F5F9",
  "--color-header-tint": "rgba(77, 124, 15, 0.06)",
  "--color-gradient-from": "#4D7C0F",
  "--color-gradient-to": "#65A30D",
  "--color-glass-bg": "rgba(255, 255, 255, 0.7)",
  "--color-glass-border": "rgba(0, 0, 0, 0.06)",
  "--color-glass-hover": "rgba(0, 0, 0, 0.03)",
  "--color-glow-primary": "rgba(132, 204, 22, 0.2)",
  "--color-status-success": "#16A34A",
  "--color-status-success-bg": "rgba(22, 163, 74, 0.10)",
  "--color-status-success-border": "rgba(22, 163, 74, 0.20)",
  "--color-status-warning": "#D97706",
  "--color-status-warning-bg": "rgba(217, 119, 6, 0.10)",
  "--color-status-warning-border": "rgba(217, 119, 6, 0.20)",
  "--color-status-error": "#DC2626",
  "--color-status-error-bg": "rgba(220, 38, 38, 0.10)",
  "--color-status-error-border": "rgba(220, 38, 38, 0.20)",
  "--color-status-info": "#2563EB",
  "--color-status-info-bg": "rgba(37, 99, 235, 0.10)",
  "--color-status-info-border": "rgba(37, 99, 235, 0.20)",
};

/* ─── DARK BASE — THE PRIMARY EXPERIENCE ─── */
export const DARK_BASE: ThemeTokens = {
  "--color-primary": "#84CC16",
  "--color-primary-light": "#A3E635",
  "--color-primary-muted": "#1A2310",
  "--color-primary-hover": "#65A30D",
  "--color-accent": "#84CC16",
  "--color-accent-light": "rgba(132, 204, 22, 0.1)",
  "--color-header-bg": "rgba(11, 15, 25, 0.8)",
  "--color-header-text": "#F1F5F9",
  "--color-sidebar-bg": "rgba(15, 20, 35, 0.95)",
  "--color-sidebar-text": "#94A3B8",
  "--color-sidebar-active-bg": "rgba(132, 204, 22, 0.1)",
  "--color-sidebar-active-text": "#A3E635",
  "--color-sidebar-hover-bg": "rgba(255, 255, 255, 0.04)",
  "--color-body-bg": "#0B0F19",
  "--color-card-bg": "rgba(255, 255, 255, 0.03)",
  "--color-card-border": "rgba(255, 255, 255, 0.10)",
  "--color-text-primary": "#F1F5F9",
  "--color-text-secondary": "#94A3B8",
  "--color-text-muted": "#4B5563",
  "--color-text-tertiary": "rgba(255, 255, 255, 0.50)",
  "--color-text-placeholder": "rgba(255, 255, 255, 0.50)",
  "--color-input-bg": "rgba(255, 255, 255, 0.05)",
  "--color-input-border": "rgba(255, 255, 255, 0.12)",
  "--color-input-focus-ring": "#84CC16",
  "--color-badge-bg": "rgba(132, 204, 22, 0.15)",
  "--color-badge-text": "#A3E635",
  "--color-button-primary-bg": "#84CC16",
  "--color-button-primary-text": "#0B0F19",
  "--color-button-primary-hover": "#65A30D",
  "--color-generate-bg": "#84CC16",
  "--color-generate-hover": "#65A30D",
  "--color-divider": "rgba(255, 255, 255, 0.10)",
  "--color-divider-strong": "rgba(255, 255, 255, 0.15)",
  "--color-border-subtle": "rgba(255, 255, 255, 0.08)",
  "--color-border-default": "rgba(255, 255, 255, 0.12)",
  "--color-border-strong": "rgba(255, 255, 255, 0.18)",
  "--color-icon-active": "rgba(255, 255, 255, 0.90)",
  "--color-icon-default": "rgba(255, 255, 255, 0.65)",
  "--color-icon-muted": "rgba(255, 255, 255, 0.50)",
  "--color-surface-raised": "rgba(255, 255, 255, 0.04)",
  "--color-surface-inset": "rgba(0, 0, 0, 0.12)",
  "--color-dropdown-bg": "rgba(20, 25, 40, 0.95)",
  "--color-dropdown-hover": "rgba(255, 255, 255, 0.08)",
  "--color-toast-bg": "rgba(20, 25, 40, 0.95)",
  "--color-modal-overlay": "rgba(0, 0, 0, 0.6)",
  "--color-modal-bg": "rgba(20, 25, 40, 0.95)",
  "--color-skeleton-base": "rgba(255, 255, 255, 0.04)",
  "--color-skeleton-shine": "rgba(255, 255, 255, 0.08)",
  "--color-header-tint": "rgba(132, 204, 22, 0.04)",
  "--color-gradient-from": "#0B0F19",
  "--color-gradient-to": "#131A2B",
  "--color-glass-bg": "rgba(255, 255, 255, 0.03)",
  "--color-glass-border": "rgba(255, 255, 255, 0.10)",
  "--color-glass-hover": "rgba(255, 255, 255, 0.05)",
  "--color-glow-primary": "rgba(132, 204, 22, 0.15)",
  "--color-status-success": "#34D399",
  "--color-status-success-bg": "rgba(52, 211, 153, 0.10)",
  "--color-status-success-border": "rgba(52, 211, 153, 0.20)",
  "--color-status-warning": "#FBBF24",
  "--color-status-warning-bg": "rgba(251, 191, 36, 0.10)",
  "--color-status-warning-border": "rgba(251, 191, 36, 0.20)",
  "--color-status-error": "#F87171",
  "--color-status-error-bg": "rgba(248, 113, 113, 0.10)",
  "--color-status-error-border": "rgba(248, 113, 113, 0.20)",
  "--color-status-info": "#60A5FA",
  "--color-status-info-bg": "rgba(96, 165, 250, 0.10)",
  "--color-status-info-border": "rgba(96, 165, 250, 0.20)",
};

/* ─── COLOR PALETTES ─── */
export const COLOR_PALETTES: Record<ColorPalette, Partial<ThemeTokens>> = {
  "midnight-lime": {
    /* Default — the Salesforce-inspired look. No overrides needed. */
  },
  "deep-ocean": {
    "--color-primary": "#06B6D4",
    "--color-primary-light": "#22D3EE",
    "--color-primary-hover": "#0891B2",
    "--color-accent": "#06B6D4",
    "--color-accent-light": "rgba(6, 182, 212, 0.1)",
    "--color-input-focus-ring": "#06B6D4",
    "--color-badge-bg": "rgba(6, 182, 212, 0.15)",
    "--color-badge-text": "#22D3EE",
    "--color-button-primary-bg": "#06B6D4",
    "--color-button-primary-hover": "#0891B2",
    "--color-generate-bg": "#06B6D4",
    "--color-generate-hover": "#0891B2",
    "--color-header-tint": "rgba(6, 182, 212, 0.04)",
    "--color-glow-primary": "rgba(6, 182, 212, 0.15)",
    "--color-sidebar-active-bg": "rgba(6, 182, 212, 0.1)",
    "--color-sidebar-active-text": "#22D3EE",
  },
  "carbon-violet": {
    "--color-primary": "#8B5CF6",
    "--color-primary-light": "#A78BFA",
    "--color-primary-hover": "#7C3AED",
    "--color-accent": "#8B5CF6",
    "--color-accent-light": "rgba(139, 92, 246, 0.1)",
    "--color-input-focus-ring": "#8B5CF6",
    "--color-badge-bg": "rgba(139, 92, 246, 0.15)",
    "--color-badge-text": "#A78BFA",
    "--color-button-primary-bg": "#8B5CF6",
    "--color-button-primary-hover": "#7C3AED",
    "--color-generate-bg": "#8B5CF6",
    "--color-generate-hover": "#7C3AED",
    "--color-header-tint": "rgba(139, 92, 246, 0.04)",
    "--color-glow-primary": "rgba(139, 92, 246, 0.15)",
    "--color-sidebar-active-bg": "rgba(139, 92, 246, 0.1)",
    "--color-sidebar-active-text": "#A78BFA",
  },
  "obsidian-amber": {
    "--color-primary": "#F59E0B",
    "--color-primary-light": "#FBBF24",
    "--color-primary-hover": "#D97706",
    "--color-accent": "#F59E0B",
    "--color-accent-light": "rgba(245, 158, 11, 0.1)",
    "--color-input-focus-ring": "#F59E0B",
    "--color-badge-bg": "rgba(245, 158, 11, 0.15)",
    "--color-badge-text": "#FBBF24",
    "--color-button-primary-bg": "#F59E0B",
    "--color-button-primary-hover": "#D97706",
    "--color-generate-bg": "#F59E0B",
    "--color-generate-hover": "#D97706",
    "--color-header-tint": "rgba(245, 158, 11, 0.04)",
    "--color-glow-primary": "rgba(245, 158, 11, 0.15)",
    "--color-sidebar-active-bg": "rgba(245, 158, 11, 0.1)",
    "--color-sidebar-active-text": "#FBBF24",
  },
};

/** Extract only accent/primary tokens from a palette for dark mode merging. */
function darkPaletteOverrides(palette: Partial<ThemeTokens> | undefined): Partial<ThemeTokens> {
  if (!palette) return {};
  const accentKeys: (keyof ThemeTokens)[] = [
    "--color-primary",
    "--color-primary-light",
    "--color-primary-hover",
    "--color-accent",
    "--color-accent-light",
    "--color-input-focus-ring",
    "--color-badge-bg",
    "--color-badge-text",
    "--color-button-primary-bg",
    "--color-button-primary-hover",
    "--color-generate-bg",
    "--color-generate-hover",
    "--color-header-tint",
    "--color-glow-primary",
    "--color-sidebar-active-bg",
    "--color-sidebar-active-text",
  ];
  const overrides: Partial<ThemeTokens> = {};
  for (const key of accentKeys) {
    if (palette[key]) overrides[key] = palette[key];
  }
  return overrides;
}

export function resolveTokens(mode: ThemeMode, palette: ColorPalette): ThemeTokens {
  const safePalette = COLOR_PALETTES[palette] ?? COLOR_PALETTES["midnight-lime"];
  if (mode === "dark") {
    return { ...DARK_BASE, ...darkPaletteOverrides(safePalette) };
  }
  if (mode === "color") return { ...LIGHT_BASE, ...safePalette };
  return { ...LIGHT_BASE };
}
