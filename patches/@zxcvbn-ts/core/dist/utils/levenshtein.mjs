// ppush — local patch of @zxcvbn-ts/core 4.2.0, applied by `patches/apply.mjs`.
//
// The original rebuilds `Object.keys()` of the dictionary (up to 330,000
// words with ppush's) at EVERY call, and it is called for the password, its
// reverse and each of its l33t variants: from 200 ms to more than a second
// per estimate. Here, the words are grouped by length once per dictionary,
// and only the lengths that can pass the original length check are examined.
//
// SAME RESULT as the original: it returns the first word, in `Object.keys()`
// order, that passes both checks; a word whose length differs by more than
// max(threshold, ceil(length / 4)) never passes the first one, since the
// threshold applied never exceeds that maximum. Among the words that pass,
// the one that comes first in the original order is kept.
//
// Upstream rewrote this function differently (PR zxcvbn-ts/zxcvbn#351, not
// released yet), with other rules (threshold as configured, the most common
// word wins): this patch goes away with the update that ships it.
import { distance } from 'fastest-levenshtein';

const getUsedThreshold = (password, entry, threshold) => {
  const isPasswordToShort = password.length <= entry.length;
  const isThresholdLongerThanPassword = password.length <= threshold;
  const shouldUsePasswordLength = isPasswordToShort || isThresholdLongerThanPassword;
  // if password is too small use the password length divided by 4 while the threshold needs to be at least 1
  return shouldUsePasswordLength ? Math.ceil(password.length / 4) : threshold;
};
// length → words of that length and their position in Object.keys(), once per dictionary
// (a dictionary never changes once built)
const indexes = new WeakMap();
const getIndex = rankedDictionary => {
  let index = indexes.get(rankedDictionary);
  if (!index) {
    index = new Map();
    Object.keys(rankedDictionary).forEach((entry, position) => {
      let group = index.get(entry.length);
      if (!group) {
        group = {
          entries: [],
          positions: []
        };
        index.set(entry.length, group);
      }
      group.entries.push(entry);
      group.positions.push(position);
    });
    indexes.set(rankedDictionary, index);
  }
  return index;
};
const findLevenshteinDistance = (password, rankedDictionary, threshold) => {
  const index = getIndex(rankedDictionary);
  const maxThreshold = Math.max(threshold, Math.ceil(password.length / 4));
  let foundPosition = -1;
  let found;
  let foundDistance = 0;
  for (let length = Math.max(0, password.length - maxThreshold); length <= password.length + maxThreshold; length += 1) {
    const group = index.get(length);
    if (!group) {
      continue;
    }
    // within a group, words are in the original order: the first one that passes is the only candidate
    for (let i = 0; i < group.entries.length; i += 1) {
      if (foundPosition >= 0 && group.positions[i] > foundPosition) {
        break;
      }
      const entry = group.entries[i];
      const usedThreshold = getUsedThreshold(password, entry, threshold);
      if (Math.abs(password.length - entry.length) > usedThreshold) {
        continue;
      }
      const foundEntryDistance = distance(password, entry);
      if (foundEntryDistance <= usedThreshold) {
        foundPosition = group.positions[i];
        found = entry;
        foundDistance = foundEntryDistance;
        break;
      }
    }
  }
  if (found) {
    return {
      levenshteinDistance: foundDistance,
      levenshteinDistanceEntry: found
    };
  }
  return {};
};

export { findLevenshteinDistance as default };
