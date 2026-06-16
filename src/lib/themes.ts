/**
 * Visual themes. Two APPLIED themes (value of `data-theme`): `midnight`
 * (dark violet) and `mecha` (light grey/lava-red). The selector also offers
 * plus `auto` = day → mecha / night → midnight, based on the visitor's LOCAL hour
 * (resolved client-side by an anti-flash inline script, see layout.tsx).
 *
 * Application priority: explicit `theme` cookie > account preference
 * (User.theme) > `auto` default. PUBLIC selector (footer); a signed-in
 * user can set their preference (persisted in the database).
 */

export const THEMES = ["midnight", "mecha"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_CHOICES = ["auto", "midnight", "mecha"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

/** SSR / no-JS fallback (day appearance). */
export const DEFAULT_THEME: Theme = "mecha";
export const THEME_COOKIE = "theme";

/** "Day" time window for auto mode (local hour). */
export const DAY_START = 7;
export const DAY_END = 19;

export function isThemeChoice(v: string | undefined | null): v is ThemeChoice {
  return !!v && (THEME_CHOICES as readonly string[]).includes(v);
}

/** Effective choice: explicit cookie > account preference > "auto". */
export function effectiveChoice(
  cookieVal: string | undefined | null,
  userTheme: string | undefined | null
): ThemeChoice {
  return isThemeChoice(cookieVal) ? cookieVal : isThemeChoice(userTheme) ? userTheme : "auto";
}

/** Resolves a choice into an applied theme (auto → based on the given hour). */
export function resolveTheme(choice: string | null | undefined, hour: number): Theme {
  if (choice === "midnight" || choice === "mecha") return choice;
  return hour >= DAY_START && hour < DAY_END ? "mecha" : "midnight";
}

/** Preview swatches (background · line · accent) for the selector. */
export const THEME_SWATCH: Record<ThemeChoice, [string, string, string]> = {
  auto: ["#e7e9ec", "#0b0d12", "#d4231a"],
  midnight: ["#0b0d12", "#232a3b", "#7c6cff"],
  mecha: ["#e7e9ec", "#cbd0d7", "#d4231a"],
};
