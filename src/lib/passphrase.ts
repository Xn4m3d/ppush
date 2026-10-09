/**
 * Word lists for the passphrase generator. Loaded on demand (dynamic
 * import): ~100 KB that only users of this mode pay for.
 * Attributions (CC BY 3.0) in the header of each list.
 */

export const WORDLIST_LANGS = ["fr", "en"] as const;
export type WordlistLang = (typeof WORDLIST_LANGS)[number];

/** Known sizes, to show the entropy before the list loads. */
export const WORDLIST_SIZE: Record<WordlistLang, number> = { fr: 6294, en: 7770 };

const cache = new Map<WordlistLang, Promise<string[]>>();

export function loadWordlist(lang: WordlistLang): Promise<string[]> {
  let p = cache.get(lang);
  if (!p) {
    p = (lang === "fr" ? import("./wordlists/fr") : import("./wordlists/en")).then((m) => m.default);
    cache.set(lang, p);
  }
  return p;
}
