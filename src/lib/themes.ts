/**
 * Visual themes. Two APPLIED themes (value of `data-theme`): `midnight`
 * — "Yoake", slate night + dawn-orange accent — and `mecha` — "Hinode",
 * ivory day + vermilion accent. The technical ids are kept as-is: they live
 * in the `theme` cookie and in `User.theme`, so renaming them would
 * invalidate already-saved preferences. The selector also offers
 * plus `auto` = day → mecha / night → midnight, based on the visitor's LOCAL hour
 * (resolved client-side by an anti-flash inline script, see layout.tsx).
 *
 * Application priority: explicit `theme` cookie > account preference
 * (User.theme) > `midnight` (night) default. PUBLIC selector (footer); a signed-in
 * user can set their preference (persisted in the database).
 */

export const THEMES = ["midnight", "mecha"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_CHOICES = ["auto", "midnight", "mecha"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

/** Default theme: night, the black of the Diffusion art direction. */
export const DEFAULT_THEME: Theme = "midnight";
export const THEME_COOKIE = "theme";

/** "Day" time window for auto mode (local hour). */
export const DAY_START = 7;
export const DAY_END = 19;

export function isThemeChoice(v: string | undefined | null): v is ThemeChoice {
  return !!v && (THEME_CHOICES as readonly string[]).includes(v);
}

/** Effective choice: explicit cookie > account preference > night. */
export function effectiveChoice(
  cookieVal: string | undefined | null,
  userTheme: string | undefined | null
): ThemeChoice {
  return isThemeChoice(cookieVal) ? cookieVal : isThemeChoice(userTheme) ? userTheme : "midnight";
}

/** Resolves a choice into an applied theme (auto → based on the given hour). */
export function resolveTheme(choice: string | null | undefined, hour: number): Theme {
  if (choice === "midnight" || choice === "mecha") return choice;
  return hour >= DAY_START && hour < DAY_END ? "mecha" : "midnight";
}

/** Preview swatches (background · line · accent) for the selector. */
export const THEME_SWATCH: Record<ThemeChoice, [string, string, string]> = {
  auto: ["#f3f4f6", "#07090d", "#ff7a59"],
  midnight: ["#07090d", "#1b222e", "#ff7a59"],
  mecha: ["#f3f4f6", "#dde1e7", "#d9482a"],
};
