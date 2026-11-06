/**
 * Strength of a TYPED password, estimated by zxcvbn-ts: the number of guesses
 * an attacker who knows common words, first names,
 * keyboard patterns, dates and substitutions ("P@ssw0rd") would need. More
 * honest than length × log2(alphabet), which would give ~78 bits to
 * "Password123!".
 *
 * Computed 100% locally (the password never leaves the browser). This module
 * bundles the dictionaries (~2 MB): it only loads in the worker of
 * `strength.ts` (or, without a worker, on the first keystroke).
 *
 * Expensive: the Levenshtein distance compares the whole password to every
 * dictionary word (330,000), for the password, its reverse and each of its
 * l33t variants. Never on the page's thread while typing.
 *
 * A GENERATED, untouched password needs no estimate: its
 * exact entropy is the generator's.
 */

import { ZxcvbnFactory } from "@zxcvbn-ts/core";
import { adjacencyGraphs, dictionary as common } from "@zxcvbn-ts/language-common";
import { dictionary as en } from "@zxcvbn-ts/language-en";
import { dictionary as fr } from "@zxcvbn-ts/language-fr";
import ppEn from "./wordlists/en";
import ppFr from "./wordlists/fr";

/** Beyond this, estimating costs a lot for nothing: strength is already maximal. */
const MAX_LENGTH = 100;
/** Minimum length of a patternless run to count it as randomness. */
const MIN_RANDOM_RUN = 4;

/** Builds the estimator (indexes the dictionaries, once): password → estimated bits (log2 of the number of guesses). */
export function createMeasure(): (pw: string) => number {
  const z = new ZxcvbnFactory({
    // keys are already suffixed by language (-common, -en, -fr): no
    // collision; the generator's lists are added, otherwise one of the site's
    // passphrases, once edited, would be overestimated (words unknown to zxcvbn)
    dictionary: { ...common, ...en, ...fr, "ppush-fr": ppFr, "ppush-en": ppEn },
    graphs: adjacencyGraphs,
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
