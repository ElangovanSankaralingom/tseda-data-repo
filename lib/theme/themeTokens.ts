export type ThemeMode = "light" | "dark" | "color";
export type ColorPalette = "midnight-lime" | "deep-ocean" | "carbon-violet" | "obsidian-amber";

export interface ThemeTokens {
  "--color-primary": string;
  "--color-primary-light": string;
  "--color-primary-muted": string;
  "--color-primary-hover": string;
  "--color-accent": string;
  "--color-accent-light": string;
  /* Dock (floating glass header) surface — unscrolled and scrolled states.
     The dock is THE header; these are its only sanctioned backgrounds. */
  "--color-header-bg": string;
  "--color-header-bg-scrolled": string;
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
  /* ─── Layered panel family — the dashboard's well → chip → tile nesting.
     Dark: literal stepped darks (was hardcoded #0e1019/#141620/#1c1e2a).
     Light: recessed well → white raised → bordered tile.
     Use these whenever a surface sits INSIDE another panel surface. ─── */
  "--color-surface-panel": string;
  "--color-surface-panel-raised": string;
  "--color-surface-panel-tile": string;
  /* Deep recess — segmented control tracks, node pits. Stronger than surface-inset. */
  "--color-surface-inset-deep": string;
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
  /* Text + surfaces sitting on top of the gradient header (or any saturated accent surface).
     Stays light in both modes because the gradient is always dark-or-saturated. */
  "--color-text-on-accent": string;
  "--color-text-on-accent-muted": string;
  "--color-surface-on-accent": string;
  "--color-surface-on-accent-strong": string;
  "--color-glass-bg": string;
  "--color-glass-border": string;
  "--color-glass-hover": string;
  "--color-glow-primary": string;
  "--color-status-success": string;
  "--color-status-success-bg": string;
  "--color-status-success-border": string;
  /* Success scale — for intensity visualisations (heatmaps, streak calendars).
     soft → default → strong → deep, used as a 4-step gradient. */
  "--color-status-success-soft": string;
  "--color-status-success-strong": string;
  "--color-status-success-deep": string;
  "--color-status-warning": string;
  "--color-status-warning-bg": string;
  "--color-status-warning-border": string;
  "--color-status-error": string;
  "--color-status-error-bg": string;
  "--color-status-error-border": string;
  "--color-status-info": string;
  "--color-status-info-bg": string;
  "--color-status-info-border": string;
  /* ─── Categorical palette — for items that need distinct, theme-stable colors
     (audit action types, admin tool tiles, stat cards). NOT remapped by accent palette. ─── */
  "--color-palette-violet-fg": string;
  "--color-palette-violet-bg": string;
  "--color-palette-violet-border": string;
  "--color-palette-purple-fg": string;
  "--color-palette-purple-bg": string;
  "--color-palette-purple-border": string;
  "--color-palette-cyan-fg": string;
  "--color-palette-cyan-bg": string;
  "--color-palette-cyan-border": string;
  "--color-palette-orange-fg": string;
  "--color-palette-orange-bg": string;
  "--color-palette-orange-border": string;
  "--color-palette-indigo-fg": string;
  "--color-palette-indigo-bg": string;
  "--color-palette-indigo-border": string;
  "--color-palette-rose-fg": string;
  "--color-palette-rose-bg": string;
  "--color-palette-rose-border": string;
  "--color-palette-yellow-fg": string;
  "--color-palette-yellow-bg": string;
  "--color-palette-yellow-border": string;
  "--color-palette-blue-fg": string;
  "--color-palette-blue-bg": string;
  "--color-palette-blue-border": string;
  "--color-palette-emerald-fg": string;
  "--color-palette-emerald-bg": string;
  "--color-palette-emerald-border": string;
  "--color-palette-amber-fg": string;
  "--color-palette-amber-bg": string;
  "--color-palette-amber-border": string;
  "--color-palette-pink-fg": string;
  "--color-palette-pink-bg": string;
  "--color-palette-pink-border": string;
}

/** Chart fallback hex for unknown-category coloring in analytics. Charts (Recharts)
 *  consume raw hex, not CSS variables, so this lives outside the token system. */
export const CHART_FALLBACK_HEX = "#64748B";

/* ─── LIGHT BASE — "paper & ink" ───
   Warm stone neutrals (hue-agnostic: works under all four accent palettes),
   true-white cards popping off a genuinely tinted page, a warm near-black
   ink ramp instead of blue slate, and crisp hairlines. Surface ladder:
   inset-deep < panel < inset < body < tile < card/raised (white). */
export const LIGHT_BASE: ThemeTokens = {
  "--color-primary": "#4D7C0F",
  "--color-primary-light": "#65A30D",
  "--color-primary-muted": "#EFF5E0",
  "--color-primary-hover": "#3F6212",
  "--color-accent": "#65A30D",
  "--color-accent-light": "#F2F7E4",
  "--color-header-bg": "rgba(252, 252, 250, 0.72)",
  "--color-header-bg-scrolled": "rgba(252, 252, 250, 0.90)",
  "--color-header-text": "#1F1D1A",
  "--color-sidebar-bg": "#FBFBF9",
  "--color-sidebar-text": "#57534E",
  "--color-sidebar-active-bg": "#EFF5E0",
  "--color-sidebar-active-text": "#3F6212",
  "--color-sidebar-hover-bg": "#F3F2EF",
  "--color-body-bg": "#F3F2EF",
  "--color-card-bg": "#FFFFFF",
  "--color-card-border": "#E2E0DA",
  "--color-text-primary": "#1F1D1A",
  "--color-text-secondary": "#57534E",
  "--color-text-muted": "#A8A29E",
  "--color-text-tertiary": "#78716C",
  "--color-text-placeholder": "#A8A29E",
  "--color-input-bg": "#FFFFFF",
  "--color-input-border": "#D7D4CD",
  "--color-input-focus-ring": "#65A30D",
  "--color-badge-bg": "#E7F0D2",
  "--color-badge-text": "#3F6212",
  "--color-button-primary-bg": "#4D7C0F",
  "--color-button-primary-text": "#FFFFFF",
  "--color-button-primary-hover": "#3F6212",
  "--color-generate-bg": "#65A30D",
  "--color-generate-hover": "#4D7C0F",
  "--color-divider": "#E5E3DD",
  "--color-divider-strong": "#D6D3CB",
  "--color-border-subtle": "#ECEAE5",
  "--color-border-default": "#E0DED7",
  "--color-border-strong": "#C9C5BC",
  "--color-icon-active": "#1F1D1A",
  "--color-icon-default": "#57534E",
  "--color-icon-muted": "#A8A29E",
  "--color-surface-raised": "#FFFFFF",
  "--color-surface-inset": "#EDECE8",
  "--color-surface-panel": "#EAE8E3",
  "--color-surface-panel-raised": "#FFFFFF",
  "--color-surface-panel-tile": "#F7F6F3",
  "--color-surface-inset-deep": "#DDDAD3",
  "--color-dropdown-bg": "#FFFFFF",
  "--color-dropdown-hover": "#F3F2EE",
  "--color-toast-bg": "#FFFFFF",
  "--color-modal-overlay": "rgba(31, 29, 26, 0.40)",
  "--color-modal-bg": "#FFFFFF",
  "--color-skeleton-base": "#E8E6E1",
  "--color-skeleton-shine": "#F4F3F0",
  "--color-header-tint": "rgba(77, 124, 15, 0.05)",
  "--color-gradient-from": "#FAFAF8",
  "--color-gradient-to": "#ECEAE4",
  "--color-text-on-accent": "#FFFFFF",
  "--color-text-on-accent-muted": "rgba(255, 255, 255, 0.72)",
  "--color-surface-on-accent": "rgba(255, 255, 255, 0.12)",
  "--color-surface-on-accent-strong": "rgba(255, 255, 255, 0.22)",
  "--color-glass-bg": "rgba(255, 255, 255, 0.78)",
  "--color-glass-border": "rgba(31, 29, 26, 0.08)",
  "--color-glass-hover": "rgba(31, 29, 26, 0.04)",
  "--color-glow-primary": "rgba(101, 163, 13, 0.16)",
  "--color-status-success": "#16A34A",
  "--color-status-success-bg": "rgba(22, 163, 74, 0.10)",
  "--color-status-success-border": "rgba(22, 163, 74, 0.20)",
  "--color-status-success-soft": "rgba(16, 185, 129, 0.20)",
  "--color-status-success-strong": "#059669",
  "--color-status-success-deep": "#065F46",
  "--color-status-warning": "#D97706",
  "--color-status-warning-bg": "rgba(217, 119, 6, 0.10)",
  "--color-status-warning-border": "rgba(217, 119, 6, 0.20)",
  "--color-status-error": "#DC2626",
  "--color-status-error-bg": "rgba(220, 38, 38, 0.10)",
  "--color-status-error-border": "rgba(220, 38, 38, 0.20)",
  "--color-status-info": "#2563EB",
  "--color-status-info-bg": "rgba(37, 99, 235, 0.10)",
  "--color-status-info-border": "rgba(37, 99, 235, 0.20)",
  /* Categorical palette — Tailwind 500 shades for light mode */
  "--color-palette-violet-fg": "#8B5CF6",
  "--color-palette-violet-bg": "rgba(139, 92, 246, 0.10)",
  "--color-palette-violet-border": "rgba(139, 92, 246, 0.20)",
  "--color-palette-purple-fg": "#A855F7",
  "--color-palette-purple-bg": "rgba(168, 85, 247, 0.10)",
  "--color-palette-purple-border": "rgba(168, 85, 247, 0.20)",
  "--color-palette-cyan-fg": "#06B6D4",
  "--color-palette-cyan-bg": "rgba(6, 182, 212, 0.10)",
  "--color-palette-cyan-border": "rgba(6, 182, 212, 0.20)",
  "--color-palette-orange-fg": "#F97316",
  "--color-palette-orange-bg": "rgba(249, 115, 22, 0.10)",
  "--color-palette-orange-border": "rgba(249, 115, 22, 0.20)",
  "--color-palette-indigo-fg": "#6366F1",
  "--color-palette-indigo-bg": "rgba(99, 102, 241, 0.10)",
  "--color-palette-indigo-border": "rgba(99, 102, 241, 0.20)",
  "--color-palette-rose-fg": "#F43F5E",
  "--color-palette-rose-bg": "rgba(244, 63, 94, 0.10)",
  "--color-palette-rose-border": "rgba(244, 63, 94, 0.20)",
  "--color-palette-yellow-fg": "#EAB308",
  "--color-palette-yellow-bg": "rgba(234, 179, 8, 0.10)",
  "--color-palette-yellow-border": "rgba(234, 179, 8, 0.20)",
  "--color-palette-blue-fg": "#2563EB",
  "--color-palette-blue-bg": "rgba(37, 99, 235, 0.10)",
  "--color-palette-blue-border": "rgba(37, 99, 235, 0.20)",
  "--color-palette-emerald-fg": "#059669",
  "--color-palette-emerald-bg": "rgba(5, 150, 105, 0.10)",
  "--color-palette-emerald-border": "rgba(5, 150, 105, 0.20)",
  "--color-palette-amber-fg": "#D97706",
  "--color-palette-amber-bg": "rgba(217, 119, 6, 0.10)",
  "--color-palette-amber-border": "rgba(217, 119, 6, 0.20)",
  "--color-palette-pink-fg": "#EC4899",
  "--color-palette-pink-bg": "rgba(236, 72, 153, 0.10)",
  "--color-palette-pink-border": "rgba(236, 72, 153, 0.20)",
};

/* ─── DARK BASE — THE PRIMARY EXPERIENCE ─── */
export const DARK_BASE: ThemeTokens = {
  "--color-primary": "#84CC16",
  "--color-primary-light": "#A3E635",
  "--color-primary-muted": "#1A2310",
  "--color-primary-hover": "#65A30D",
  "--color-accent": "#84CC16",
  "--color-accent-light": "rgba(132, 204, 22, 0.1)",
  "--color-header-bg": "rgba(8, 10, 18, 0.70)",
  "--color-header-bg-scrolled": "rgba(8, 10, 18, 0.85)",
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
  "--color-surface-panel": "#0E1019",
  "--color-surface-panel-raised": "#141620",
  "--color-surface-panel-tile": "#1C1E2A",
  "--color-surface-inset-deep": "rgba(0, 0, 0, 0.4)",
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
  "--color-text-on-accent": "#F1F5F9",
  "--color-text-on-accent-muted": "rgba(255, 255, 255, 0.65)",
  "--color-surface-on-accent": "rgba(255, 255, 255, 0.08)",
  "--color-surface-on-accent-strong": "rgba(255, 255, 255, 0.16)",
  "--color-glass-bg": "rgba(255, 255, 255, 0.03)",
  "--color-glass-border": "rgba(255, 255, 255, 0.10)",
  "--color-glass-hover": "rgba(255, 255, 255, 0.05)",
  "--color-glow-primary": "rgba(132, 204, 22, 0.15)",
  "--color-status-success": "#34D399",
  "--color-status-success-bg": "rgba(52, 211, 153, 0.10)",
  "--color-status-success-border": "rgba(52, 211, 153, 0.20)",
  "--color-status-success-soft": "rgba(52, 211, 153, 0.20)",
  "--color-status-success-strong": "#059669",
  "--color-status-success-deep": "#065F46",
  "--color-status-warning": "#FBBF24",
  "--color-status-warning-bg": "rgba(251, 191, 36, 0.10)",
  "--color-status-warning-border": "rgba(251, 191, 36, 0.20)",
  "--color-status-error": "#F87171",
  "--color-status-error-bg": "rgba(248, 113, 113, 0.10)",
  "--color-status-error-border": "rgba(248, 113, 113, 0.20)",
  "--color-status-info": "#60A5FA",
  "--color-status-info-bg": "rgba(96, 165, 250, 0.10)",
  "--color-status-info-border": "rgba(96, 165, 250, 0.20)",
  /* Categorical palette — Tailwind 400 shades for dark mode (alphas held stable) */
  "--color-palette-violet-fg": "#A78BFA",
  "--color-palette-violet-bg": "rgba(167, 139, 250, 0.10)",
  "--color-palette-violet-border": "rgba(167, 139, 250, 0.20)",
  "--color-palette-purple-fg": "#C084FC",
  "--color-palette-purple-bg": "rgba(192, 132, 252, 0.10)",
  "--color-palette-purple-border": "rgba(192, 132, 252, 0.20)",
  "--color-palette-cyan-fg": "#22D3EE",
  "--color-palette-cyan-bg": "rgba(34, 211, 238, 0.10)",
  "--color-palette-cyan-border": "rgba(34, 211, 238, 0.20)",
  "--color-palette-orange-fg": "#FB923C",
  "--color-palette-orange-bg": "rgba(251, 146, 60, 0.10)",
  "--color-palette-orange-border": "rgba(251, 146, 60, 0.20)",
  "--color-palette-indigo-fg": "#818CF8",
  "--color-palette-indigo-bg": "rgba(129, 140, 248, 0.10)",
  "--color-palette-indigo-border": "rgba(129, 140, 248, 0.20)",
  "--color-palette-rose-fg": "#FB7185",
  "--color-palette-rose-bg": "rgba(251, 113, 133, 0.10)",
  "--color-palette-rose-border": "rgba(251, 113, 133, 0.20)",
  "--color-palette-yellow-fg": "#FACC15",
  "--color-palette-yellow-bg": "rgba(250, 204, 21, 0.10)",
  "--color-palette-yellow-border": "rgba(250, 204, 21, 0.20)",
  "--color-palette-blue-fg": "#60A5FA",
  "--color-palette-blue-bg": "rgba(96, 165, 250, 0.10)",
  "--color-palette-blue-border": "rgba(96, 165, 250, 0.20)",
  "--color-palette-emerald-fg": "#34D399",
  "--color-palette-emerald-bg": "rgba(52, 211, 153, 0.10)",
  "--color-palette-emerald-border": "rgba(52, 211, 153, 0.20)",
  "--color-palette-amber-fg": "#FBBF24",
  "--color-palette-amber-bg": "rgba(251, 191, 36, 0.10)",
  "--color-palette-amber-border": "rgba(251, 191, 36, 0.20)",
  "--color-palette-pink-fg": "#F472B6",
  "--color-palette-pink-bg": "rgba(244, 114, 182, 0.10)",
  "--color-palette-pink-border": "rgba(244, 114, 182, 0.20)",
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

/**
 * Serialize resolved tokens to a single `:root` CSS rule for server-side
 * emission (app/(protected)/layout.tsx). Rendered as an inline <style> so the
 * FIRST paint already matches the user's saved mode/palette — without this,
 * light-mode users flash the dark fallback from globals.css until
 * ThemeProvider's useEffect runs.
 */
export function buildThemeCss(mode: ThemeMode, palette: ColorPalette): string {
  const tokens = resolveTokens(mode, palette);
  const vars = Object.entries(tokens)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
  return `:root{color-scheme:${mode === "dark" ? "dark" : "light"};${vars}}`;
}
