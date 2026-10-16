import { useLocale } from "next-intl";
import { localePath } from "./locale";

/** Client side: `lp("/about")` → `/about` in English, `/fr/about` in French. */
export function useLocalePath(): (path: string) => string {
  const locale = useLocale();
  return (path: string) => localePath(locale, path);
}
