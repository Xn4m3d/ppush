/**
 * Secret generator settings. Shared by client and server (no Node
 * dependency): the server sanitizes what it stores, the client what it reads back
 * (localStorage, account value). Any out-of-range value falls back to the
 * standard setting, field by field.
 */

export type GenMode = "chars" | "words";
export const SEPARATORS = ["-", " ", ".", "_"] as const;
export type Separator = (typeof SEPARATORS)[number];
/**
 * Symbols offered for selection (easy to type on any keyboard). The
 * checked symbols (`symbolSet`) serve both modes: the alphabet of the random
 * characters mode, and the draw of the passphrase's final character.
 */
export const SYMBOL_CATALOG = "!?#$%&*+-=@_.:~^";
export const DEFAULT_SYMBOL_SET = "!?#$%&*+-=@_";
/** "none": no final character; "random": drawn from `symbolSet` (a single checked one = always that one). */
export type EndSymbol = "none" | "random";

/** Keeps only catalog symbols, without duplicates, in catalog order. */
export function normalizeSymbolSet(v: string): string {
  return [...SYMBOL_CATALOG].filter((c) => v.includes(c)).join("");
}

export type GenPrefs = {
  mode: GenMode;
  // random characters
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  digits: boolean;
  symbols: boolean;
  ambiguous: boolean;
  /** Allowed symbols (at least one), shared by both modes. */
  symbolSet: string;
  // word passphrase
  words: number;
  separator: Separator;
  capitalize: boolean;
  digitCount: number;
  symbol: EndSymbol;
  lang: "fr" | "en";
};

/**
 * Key of the setting remembered in the browser. The old key was written on
 * every visit (default setting included): it is erased and ignored,
 * so everyone starts again from the current default.
 */
export const GEN_STORAGE_KEY = "ppush-generator";
export const LEGACY_GEN_STORAGE_KEY = "ppush-gen";

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
    symbolSet: DEFAULT_SYMBOL_SET,
    // 3 words + 2 digits + symbol ≈ 50 bits: at least "fair"
    words: 3,
    separator: "-",
    capitalize: true,
    digitCount: 2,
    symbol: "random",
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
    symbolSet: typeof r.symbolSet === "string" && normalizeSymbolSet(r.symbolSet) ? normalizeSymbolSet(r.symbolSet) : d.symbolSet,
    symbol: r.symbol === "none" || r.symbol === "random" ? r.symbol : d.symbol,
    lang: r.lang === "fr" || r.lang === "en" ? r.lang : d.lang,
  };
  // old format: a fixed final symbol → "drawn from" that single symbol
  if (typeof r.symbol === "string" && r.symbol.length === 1 && SYMBOL_CATALOG.includes(r.symbol)) {
    out.symbol = "random";
    out.symbolSet = r.symbol;
  }
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
