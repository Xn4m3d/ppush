/**
 * Visual themes. "midnight" = the historical dark violet theme.
 * Switching is done via the `data-theme` attribute on <html>: Tailwind
 * utilities reference var(--color-*), so redefining those variables on a
 * [data-theme] scope (see globals.css) switches the whole UI through the
 * cascade — no class changes needed.
 *
 * The chosen theme is remembered in the `theme` cookie, read server-side in
 * layout.tsx (SSR, no flash). The theme picker is rendered for the admin only.
 *
 * Add a theme: add it here, create the html[data-theme="<id>"] block in
 * globals.css, add its swatch below and its label in messages/*.
 */

export const THEMES = ["midnight", "mecha"] as const;
export type Theme = (typeof THEMES)[number];
// Public default = "mecha" (light grey / lava-red). "midnight" (dark violet)
// stays available via the picker and the `theme` cookie.
export const DEFAULT_THEME: Theme = "mecha";
export const THEME_COOKIE = "theme";

export function isTheme(v: string | undefined | null): v is Theme {
  return !!v && (THEMES as readonly string[]).includes(v);
}

/** Preview swatches (background · line · accent) shown in the picker. */
export const THEME_SWATCH: Record<Theme, [string, string, string]> = {
  midnight: ["#0b0d12", "#232a3b", "#7c6cff"],
  mecha: ["#e7e9ec", "#cbd0d7", "#d4231a"],
};
