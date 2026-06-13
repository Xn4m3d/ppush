/**
 * Shared client/server input validation. Stricter than `zod.email()`
 * (which accepts `a@b`, TLD-less domains, etc.): requires local@domain.tld
 * with an alphabetic TLD of at least 2 characters.
 */
export const EMAIL_RE =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

export function isValidEmail(value: string): boolean {
  const e = value.trim();
  return e.length >= 3 && e.length <= 255 && EMAIL_RE.test(e);
}
