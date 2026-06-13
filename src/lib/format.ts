/** Shared client/server formatting helpers (no Node dependency). */

import type { Locale } from "@/i18n/locale";

const BYTE_UNITS: Record<Locale, string[]> = {
  en: ["B", "KB", "MB", "GB", "TB"],
  fr: ["o", "Ko", "Mo", "Go", "To"],
};

/** 1234567 → "1.2 MB" (en) / "1,2 Mo" (fr) */
export function formatBytes(bytes: number, locale: Locale = "en"): string {
  const units = BYTE_UNITS[locale];
  if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} ${units[0]}`;
  let v = bytes;
  let i = 0;
  do {
    v /= 1024;
    i++;
  } while (v >= 1024 && i < units.length - 1);
  let s = v >= 100 ? String(Math.round(v)) : v.toFixed(1).replace(/\.0$/, "");
  if (locale === "fr") s = s.replace(".", ",");
  return `${s} ${units[i]}`;
}

/** Delay in ms → "45 min" / "3 h" / "1 d|j" (rounded up).
 *  An exact multiple of days is shown in days (e.g. 1440 min → "1 d"). */
export function formatDelay(ms: number, locale: Locale = "en"): string {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  if (min < 60) return `${min} min`;
  const day = locale === "fr" ? "j" : "d";
  if (min % 1440 === 0) return `${min / 1440} ${day}`;
  const h = Math.ceil(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.ceil(h / 24)} ${day}`;
}
