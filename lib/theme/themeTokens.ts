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
  /* Page background gradient (signin, maintenance). Paper in light, deep navy in dark. */
  "--color-gradient-from": string;
  "--color-gradient-to": string;
  /* Hero band — always-dark banner surface (admin page headers). Pairs with
     --color-text-on-accent. Deep ink in light (deliberate contrast on paper),
     near-black navy in dark. */
  "--color-band-from": string;
  "--color-band-to": string;
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

/* ─── LIGHT BASE — "daylight navy" ───
   Derivation rule: light mode is the DAYLIGHT version of the dark world,
   not a different material. Every neutral sits on the dark base's hue
   (~225°, the #0B0F19 navy) at high lightness — a cool ice ramp. Lime stays
   the single action voice (cool field + lime = the same relationship dark
   mode has). Status & category hues are semantic and unchanged.
   Ladder rule (strict alternation): ice field → WHITE container →
   ice-tint sub-card → white/inset pill. No near-identical neighbors. */
export const LIGHT_BASE: ThemeTokens = {
  "--color-primary": "#2A48CE",
  "--color-primary-light": "#4366E6",
  "--color-primary-muted": "#E4EBFE",
  "--color-primary-hover": "#233BAE",
  "--color-accent": "#2A48CE",
  "--color-accent-light": "#EEEFFC",
  "--color-header-bg": "rgba(255, 255, 255, 0.64)",
  "--color-header-bg-scrolled": "rgba(248, 250, 255, 0.93)",
  "--color-header-text": "#14161D",
  "--color-sidebar-bg": "#FBFCFE",
  "--color-sidebar-text": "#515765",
  "--color-sidebar-active-bg": "#E4EBFE",
  "--color-sidebar-active-text": "#233BAE",
  "--color-sidebar-hover-bg": "#F5F7FD",
  /* Legibility floor (faculty of all ages): every content-text token meets
     WCAG AA 4.5:1 on BOTH white cards and the ice field. Muted is the
     lightest text allowed and still passes. */
  "--color-body-bg": "#F5F7FD",
  "--color-card-bg": "#FFFFFF",
  "--color-card-border": "#DFE5F3",
  "--color-text-primary": "#14161D",
  "--color-text-secondary": "#3C4351",
  "--color-text-muted": "#5E6575",
  "--color-text-tertiary": "#545B6B",
  "--color-text-placeholder": "#767D8D",
  "--color-input-bg": "#FFFFFF",
  "--color-input-border": "#C8D1E7",
  "--color-input-focus-ring": "#2A48CE",
  "--color-badge-bg": "#E5E7FA",
  "--color-badge-text": "#233BAE",
  "--color-button-primary-bg": "#2A48CE",
  "--color-button-primary-text": "#FFFFFF",
  "--color-button-primary-hover": "#233BAE",
  "--color-generate-bg": "#2A48CE",
  "--color-generate-hover": "#233BAE",
  "--color-divider": "#E5EAF6",
  "--color-divider-strong": "#D6DDEE",
  "--color-border-subtle": "#E9EDF8",
  "--color-border-default": "#DCE2F1",
  "--color-border-strong": "#C5CEE6",
  "--color-icon-active": "#14161D",
  "--color-icon-default": "#3C4351",
  "--color-icon-muted": "#5E6575",
  "--color-surface-raised": "#FFFFFF",
  "--color-surface-inset": "#F2F5FD",
  "--color-surface-panel": "#FFFFFF",
  "--color-surface-panel-raised": "#FFFFFF",
  "--color-surface-panel-tile": "#F4F7FE",
  "--color-surface-inset-deep": "#E9EEFB",
  "--color-dropdown-bg": "#FFFFFF",
  "--color-dropdown-hover": "#F0F4FD",
  "--color-toast-bg": "#FFFFFF",
  "--color-modal-overlay": "rgba(20, 24, 34, 0.42)",
  "--color-modal-bg": "#FFFFFF",
  "--color-skeleton-base": "#E9EDFA",
  "--color-skeleton-shine": "#F4F7FD",
  "--color-header-tint": "rgba(42, 72, 206, 0.05)",
  "--color-gradient-from": "#F7F9FE",
  "--color-gradient-to": "#E9EEFB",
  "--color-band-from": "#2A48CE",
  "--color-band-to": "#3D5BDE",
  "--color-text-on-accent": "#FFFFFF",
  "--color-text-on-accent-muted": "rgba(255, 255, 255, 0.74)",
  "--color-surface-on-accent": "rgba(255, 255, 255, 0.12)",
  "--color-surface-on-accent-strong": "rgba(255, 255, 255, 0.22)",
  "--color-glass-bg": "rgba(255, 255, 255, 0.64)",
  "--color-glass-border": "rgba(20, 26, 42, 0.10)",
  "--color-glass-hover": "rgba(22, 26, 38, 0.04)",
  "--color-glow-primary": "rgba(42, 72, 206, 0.15)",
  "--color-status-success": "#15924A",
  "--color-status-success-bg": "rgba(21, 146, 74, 0.10)",
  "--color-status-success-border": "rgba(21, 146, 74, 0.20)",
  "--color-status-success-soft": "rgba(16, 185, 129, 0.20)",
  "--color-status-success-strong": "#059669",
  "--color-status-success-deep": "#065F46",
  "--color-status-warning": "#B07A1E",
  "--color-status-warning-bg": "rgba(176, 122, 30, 0.10)",
  "--color-status-warning-border": "rgba(176, 122, 30, 0.20)",
  "--color-status-error": "#C4362F",
  "--color-status-error-bg": "rgba(196, 54, 47, 0.10)",
  "--color-status-error-border": "rgba(196, 54, 47, 0.20)",
  "--color-status-info": "#1E7FB0",
  "--color-status-info-bg": "rgba(30, 127, 176, 0.10)",
  "--color-status-info-border": "rgba(30, 127, 176, 0.20)",
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
  "--color-primary": "#8AA2F8",
  "--color-primary-light": "#AEBEFB",
  "--color-primary-muted": "#12172A",
  "--color-primary-hover": "#7389E6",
  "--color-accent": "#8AA2F8",
  "--color-accent-light": "rgba(138, 162, 248, 0.10)",
  "--color-header-bg": "rgba(8, 9, 14, 0.72)",
  "--color-header-bg-scrolled": "rgba(8, 9, 14, 0.88)",
  "--color-header-text": "#F4F4F6",
  "--color-sidebar-bg": "rgba(14, 15, 21, 0.96)",
  "--color-sidebar-text": "#9A9BA6",
  "--color-sidebar-active-bg": "rgba(138, 162, 248, 0.12)",
  "--color-sidebar-active-text": "#AEBEFB",
  "--color-sidebar-hover-bg": "rgba(255, 255, 255, 0.04)",
  "--color-body-bg": "#0A0B11",
  "--color-card-bg": "rgba(255, 255, 255, 0.03)",
  "--color-card-border": "rgba(255, 255, 255, 0.08)",
  "--color-text-primary": "#F4F4F6",
  "--color-text-secondary": "#9A9BA6",
  "--color-text-muted": "#6A6B76",
  "--color-text-tertiary": "rgba(255, 255, 255, 0.52)",
  "--color-text-placeholder": "rgba(255, 255, 255, 0.46)",
  "--color-input-bg": "rgba(255, 255, 255, 0.05)",
  "--color-input-border": "rgba(255, 255, 255, 0.12)",
  "--color-input-focus-ring": "#8AA2F8",
  "--color-badge-bg": "rgba(138, 162, 248, 0.15)",
  "--color-badge-text": "#AEBEFB",
  "--color-button-primary-bg": "#3D5BDE",
  "--color-button-primary-text": "#FFFFFF",
  "--color-button-primary-hover": "#3149C0",
  "--color-generate-bg": "#3D5BDE",
  "--color-generate-hover": "#3149C0",
  "--color-divider": "rgba(255, 255, 255, 0.08)",
  "--color-divider-strong": "rgba(255, 255, 255, 0.14)",
  "--color-border-subtle": "rgba(255, 255, 255, 0.06)",
  "--color-border-default": "rgba(255, 255, 255, 0.11)",
  "--color-border-strong": "rgba(255, 255, 255, 0.18)",
  "--color-icon-active": "rgba(255, 255, 255, 0.92)",
  "--color-icon-default": "rgba(255, 255, 255, 0.66)",
  "--color-icon-muted": "rgba(255, 255, 255, 0.50)",
  "--color-surface-raised": "rgba(255, 255, 255, 0.04)",
  "--color-surface-inset": "rgba(0, 0, 0, 0.16)",
  "--color-surface-panel": "#0E0F16",
  "--color-surface-panel-raised": "#15161F",
  "--color-surface-panel-tile": "#1E1F2A",
  "--color-surface-inset-deep": "rgba(0, 0, 0, 0.42)",
  "--color-dropdown-bg": "rgba(18, 19, 26, 0.96)",
  "--color-dropdown-hover": "rgba(255, 255, 255, 0.07)",
  "--color-toast-bg": "rgba(18, 19, 26, 0.96)",
  "--color-modal-overlay": "rgba(0, 0, 0, 0.64)",
  "--color-modal-bg": "rgba(18, 19, 26, 0.97)",
  "--color-skeleton-base": "rgba(255, 255, 255, 0.04)",
  "--color-skeleton-shine": "rgba(255, 255, 255, 0.08)",
  "--color-header-tint": "rgba(138, 162, 248, 0.05)",
  "--color-gradient-from": "#0A0B11",
  "--color-gradient-to": "#121526",
  "--color-band-from": "#0A0B11",
  "--color-band-to": "#121526",
  "--color-text-on-accent": "#F4F4F6",
  "--color-text-on-accent-muted": "rgba(255, 255, 255, 0.66)",
  "--color-surface-on-accent": "rgba(255, 255, 255, 0.08)",
  "--color-surface-on-accent-strong": "rgba(255, 255, 255, 0.16)",
  "--color-glass-bg": "rgba(255, 255, 255, 0.03)",
  "--color-glass-border": "rgba(255, 255, 255, 0.08)",
  "--color-glass-hover": "rgba(255, 255, 255, 0.05)",
  "--color-glow-primary": "rgba(138, 162, 248, 0.18)",
  "--color-status-success": "#3DD68F",
  "--color-status-success-bg": "rgba(61, 214, 143, 0.10)",
  "--color-status-success-border": "rgba(61, 214, 143, 0.20)",
  "--color-status-success-soft": "rgba(61, 214, 143, 0.20)",
  "--color-status-success-strong": "#059669",
  "--color-status-success-deep": "#065F46",
  "--color-status-warning": "#E6B24A",
  "--color-status-warning-bg": "rgba(230, 178, 74, 0.10)",
  "--color-status-warning-border": "rgba(230, 178, 74, 0.20)",
  "--color-status-error": "#EF8079",
  "--color-status-error-bg": "rgba(239, 128, 121, 0.10)",
  "--color-status-error-border": "rgba(239, 128, 121, 0.20)",
  "--color-status-info": "#4DB8E8",
  "--color-status-info-bg": "rgba(77, 184, 232, 0.10)",
  "--color-status-info-border": "rgba(77, 184, 232, 0.20)",
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
