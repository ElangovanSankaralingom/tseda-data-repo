/**
 * Custom-accent derivation.
 *
 * The appearance picker chooses ONE accent colour via Hue / Saturation /
 * Lightness sliders. From that single colour we derive the full accent token
 * family (primary, band gradient, buttons, badges, glows, sidebar, …) — the
 * same set the old fixed palettes hand-tuned.
 *
 * Legibility: the hero bands paint white text on the accent, so the accent
 * must stay a saturated mid-tone. `clampAccentHsl` keeps hue free but pins
 * saturation/lightness to a readable window.
 */
import type { ThemeTokens } from "./themeTokens";

export type Hsl = { h: number; s: number; l: number };

/** Readable window: hue is free; sat/lightness stay where white text reads on the band. */
export const ACCENT_SAT_MIN = 0.42;
export const ACCENT_SAT_MAX = 1;
export const ACCENT_LIGHT_MIN = 0.24;
export const ACCENT_LIGHT_MAX = 0.6;
/** Minimum white-text-on-accent contrast the hero bands must keep. */
const WHITE_CONTRAST_TARGET = 3.5;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function relLuminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function whiteContrast(rgb: [number, number, number]): number {
  return 1.05 / (relLuminance(rgb) + 0.05);
}

/**
 * Clamp to the readable window, THEN — because HSL lightness is not perceptual
 * luminance (a green at L49 is far brighter than a blue at L49) — darken just
 * enough that white text on the accent keeps a legible contrast on the bands.
 */
export function clampAccentHsl({ h, s, l }: Hsl): Hsl {
  const hh = ((Math.round(h) % 360) + 360) % 360;
  const ss = Math.min(ACCENT_SAT_MAX, Math.max(ACCENT_SAT_MIN, s));
  let ll = Math.min(ACCENT_LIGHT_MAX, Math.max(ACCENT_LIGHT_MIN, l));
  let guard = 0;
  while (
    whiteContrast(hslToRgb({ h: hh, s: ss, l: ll })) < WHITE_CONTRAST_TARGET &&
    ll > ACCENT_LIGHT_MIN &&
    guard++ < 80
  ) {
    ll = Math.max(ACCENT_LIGHT_MIN, ll - 0.01);
  }
  return { h: hh, s: ss, l: ll };
}

function hslToRgb({ h, s, l }: Hsl): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export function hslToHex(hsl: Hsl): string {
  const [r, g, b] = hslToRgb(hsl);
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function hexToHsl(hex: string): Hsl {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return { h: ((Math.round(h) % 360) + 360) % 360, s, l };
}

/** Default accent — the lapis the app shipped with. */
export const DEFAULT_ACCENT_HEX = "#2A48CE";

/** Migration: old fixed-palette names → their accent hex. */
export const PRESET_ACCENT_HEX: Record<string, string> = {
  "midnight-lime": "#2A48CE",
  "deep-ocean": "#06B6D4",
  "carbon-violet": "#8B5CF6",
  "obsidian-amber": "#F59E0B",
};

/** Normalise any saved value (hex, "h,s,l", or old preset name) to a clamped hex. */
export function normaliseAccent(value: string | null | undefined): string {
  if (!value) return DEFAULT_ACCENT_HEX;
  const v = value.trim();
  if (/^#?[0-9a-fA-F]{6}$/.test(v)) {
    return hslToHex(clampAccentHsl(hexToHsl(v.startsWith("#") ? v : "#" + v)));
  }
  const hsl = v.match(/^(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)$/);
  if (hsl) return hslToHex(clampAccentHsl({ h: +hsl[1], s: +hsl[2], l: +hsl[3] }));
  if (PRESET_ACCENT_HEX[v]) return hslToHex(clampAccentHsl(hexToHsl(PRESET_ACCENT_HEX[v])));
  return DEFAULT_ACCENT_HEX;
}

/** Accent-family token keys merged into BOTH modes (band-from/to are light-only — dark band stays near-black). */
export const ACCENT_TOKEN_KEYS: (keyof ThemeTokens)[] = [
  "--color-primary",
  "--color-primary-light",
  "--color-primary-muted",
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

/**
 * Derive the full accent family from a clamped accent hex.
 * `bandKeys` (band-from/to) are included only for light mode.
 */
export function deriveAccentTokens(accentHex: string): Partial<ThemeTokens> {
  const base = hexToHsl(accentHex);
  const at = (dL: number, dS = 0): string =>
    hslToHex({ h: base.h, s: clamp01(base.s + dS), l: clamp01(base.l + dL) });
  const [r, g, b] = hslToRgb(base);
  const rgba = (a: number) => `rgba(${r}, ${g}, ${b}, ${a})`;

  return {
    "--color-primary": accentHex,
    "--color-primary-light": at(0.1),
    "--color-primary-muted": hslToHex({ h: base.h, s: Math.min(base.s, 0.85), l: 0.94 }),
    "--color-primary-hover": at(-0.09),
    "--color-accent": accentHex,
    "--color-accent-light": rgba(0.1),
    "--color-input-focus-ring": accentHex,
    "--color-badge-bg": rgba(0.15),
    "--color-badge-text": at(-0.06),
    "--color-button-primary-bg": accentHex,
    "--color-button-primary-hover": at(-0.09),
    "--color-generate-bg": accentHex,
    "--color-generate-hover": at(-0.09),
    "--color-header-tint": rgba(0.04),
    "--color-glow-primary": rgba(0.15),
    "--color-sidebar-active-bg": rgba(0.1),
    "--color-sidebar-active-text": at(-0.06),
    // band gradient — light mode only (resolveTokens drops these in dark)
    "--color-band-from": accentHex,
    "--color-band-to": at(0.07),
  };
}
