/**
 * Worker of the strength estimate (see `strength.ts`): zxcvbn and its
 * dictionaries live here, off the page's thread. One request at a time,
 * one answer per request (`bits: null` if the estimate failed).
 */

import { createMeasure } from "./strength-measure";

let measure: ((pw: string) => number) | null = null;

self.addEventListener("message", (e: MessageEvent<{ id: number; pw: string }>) => {
  const { id, pw } = e.data;
  let bits: number | null = null;
  try {
    measure ??= createMeasure();
    bits = measure(pw);
  } catch {
    // the meter stays "measuring", as if the estimate had not completed
  }
  self.postMessage({ id, bits });
});
