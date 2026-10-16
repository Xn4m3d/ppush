/**
 * Strength of a TYPED password, estimated by zxcvbn-ts: the number of guesses
 * an attacker who knows common words, first names,
 * keyboard patterns, dates and substitutions ("P@ssw0rd") would need. More
 * honest than length × log2(alphabet), which would give ~78 bits to
 * "Password123!".
 *
 * Computed 100% locally (the password never leaves the browser). The
 * dictionaries (~2 MB) are only loaded on the first keystroke.
 *
 * A GENERATED, untouched password needs no estimate: its
 * exact entropy is the generator's.
 */

import { loadWordlist } from "./passphrase";

/** Beyond this, estimating costs a lot for nothing: strength is already maximal. */
const MAX_LENGTH = 100;
/** Minimum length of a patternless run to count it as randomness. */
const MIN_RANDOM_RUN = 4;

let loading: Promise<(pw: string) => number> | null = null;

/** Returns a function password → estimated bits (log2 of the number of guesses). */
export function loadStrength(): Promise<(pw: string) => number> {
  loading ??= (async () => {
    const [{ ZxcvbnFactory }, common, en, fr, ppFr, ppEn] = await Promise.all([
      import("@zxcvbn-ts/core"),
      import("@zxcvbn-ts/language-common"),
      import("@zxcvbn-ts/language-en"),
      import("@zxcvbn-ts/language-fr"),
      loadWordlist("fr"),
      loadWordlist("en"),
    ]);
    const z = new ZxcvbnFactory({
      // keys are already suffixed by language (-common, -en, -fr): no
      // collision; the generator's lists are added, otherwise one of the site's
      // passphrases, once edited, would be overestimated (words unknown to zxcvbn)
      dictionary: { ...common.dictionary, ...en.dictionary, ...fr.dictionary, "ppush-fr": ppFr, "ppush-en": ppEn },
      graphs: common.adjacencyGraphs,
      useLevenshteinDistance: true,
    });
    return (pw: string) => {
      const s = pw.slice(0, MAX_LENGTH);
      const r = z.check(s);
      // zxcvbn counts 10 possibilities per character on runs where it
      // recognizes no pattern ("bruteforce"): very cautious for a truly
      // random string (16 randomly drawn characters → ~53 bits instead
      // of ~105). Those runs are recounted on the alphabet actually
      // used; recognized patterns keep zxcvbn's estimate. Short
      // runs ("96-", "%" between two words) are structure,
      // not randomness: they are left to zxcvbn so as not to overestimate.
      const extra = r.sequence
        .filter((m) => m.pattern === "bruteforce" && m.token.length >= MIN_RANDOM_RUN)
        .reduce((sum, m) => sum + Math.max(0, m.token.length * Math.log2(alphabetSize(m.token)) - m.guessesLog10 * Math.log2(10)), 0);
      return r.guessesLog10 * Math.log2(10) + extra;
    };
  })();
  // a loading failure (network) must not block later attempts
  loading.catch(() => { loading = null; });
  return loading;
}

/** Alphabet size from the classes present (lowercase, uppercase, digits, others). */
function alphabetSize(s: string): number {
  let n = 0;
  if (/[a-z]/.test(s)) n += 26;
  if (/[A-Z]/.test(s)) n += 26;
  if (/[0-9]/.test(s)) n += 10;
  if (/[^a-zA-Z0-9]/.test(s)) n += 33;
  return Math.max(n, 10);
}

export type StrengthLevel = "weak" | "fair" | "good" | "strong";

/**
 * Levels aligned with the entropy table: below 40 bits, falls within
 * minutes against one graphics card; 60 bits = common benchmark;
 * 80 bits = CNIL threshold for a password used on its own.
 */
export function strengthLevel(bits: number): StrengthLevel {
  if (bits < 40) return "weak";
  if (bits < 60) return "fair";
  if (bits < 80) return "good";
  return "strong";
}
