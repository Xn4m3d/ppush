/**
 * Secret generator settings. Shared by client and server (no Node
 * dependency): the server sanitizes what it stores, the client what it reads back
 * (localStorage, account value). Any out-of-range value falls back to the
 * standard setting, field by field.
 */

export type GenMode = "chars" | "words";
export const SEPARATORS = ["-", " ", ".", "_"] as const;
export type Separator = (typeof SEPARATORS)[number];

export type GenPrefs = {
  mode: GenMode;
  // random characters
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  digits: boolean;
  symbols: boolean;
  ambiguous: boolean;
  // word passphrase
  words: number;
  separator: Separator;
  capitalize: boolean;
  digitCount: number;
  lang: "fr" | "en";
};

export const LIMITS = { length: [8, 64], words: [2, 7], digitCount: [0, 6] } as const;

export function genDefaults(locale: string): GenPrefs {
  return {
    // words are the recommended mode: easier to remember and to
    // read out, just as strong at a reasonable length
    mode: "words",
    length: 20,
    lowercase: true,
    uppercase: true,
    digits: true,
    symbols: true,
    ambiguous: false,
    words: 5,
    separator: "-",
    capitalize: true,
    digitCount: 2,
    lang: locale === "fr" ? "fr" : "en",
  };
}

const int = (v: unknown, [lo, hi]: readonly [number, number], d: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : d;
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);

export function sanitizeGenPrefs(raw: unknown, locale: string): GenPrefs {
  const d = genDefaults(locale);
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: GenPrefs = {
    mode: r.mode === "words" || r.mode === "chars" ? r.mode : d.mode,
    length: int(r.length, LIMITS.length, d.length),
    lowercase: bool(r.lowercase, d.lowercase),
    uppercase: bool(r.uppercase, d.uppercase),
    digits: bool(r.digits, d.digits),
    symbols: bool(r.symbols, d.symbols),
    ambiguous: bool(r.ambiguous, d.ambiguous),
    words: int(r.words, LIMITS.words, d.words),
    separator: (SEPARATORS as readonly unknown[]).includes(r.separator) ? (r.separator as Separator) : d.separator,
    capitalize: bool(r.capitalize, d.capitalize),
    digitCount: int(r.digitCount, LIMITS.digitCount, d.digitCount),
    lang: r.lang === "fr" || r.lang === "en" ? r.lang : d.lang,
  };
  // at least one character class enabled
  if (!out.lowercase && !out.uppercase && !out.digits && !out.symbols) out.lowercase = true;
  return out;
}

/** Reads a stored value (JSON); null if missing or unreadable. */
export function parseGenPrefs(json: string | null | undefined, locale: string): GenPrefs | null {
  if (!json) return null;
  try {
    return sanitizeGenPrefs(JSON.parse(json), locale);
  } catch {
    return null;
  }
}
