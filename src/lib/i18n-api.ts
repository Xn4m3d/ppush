/**
 * Translation for API routes: same messages/*.json catalog as the UI,
 * "api" namespace. Usage: const t = await apiT(req); apiError(t("notFound"), 404)
 */

import { createTranslator } from "next-intl";
import { requestLocale, type Locale } from "@/i18n/locale";

const catalogs = {
  en: () => import("@/../messages/en.json"),
  fr: () => import("@/../messages/fr.json"),
} satisfies Record<Locale, () => Promise<{ default: unknown }>>;

export type ApiTranslator = ReturnType<typeof createTranslator<Messages, "api">>;
type Messages = typeof import("@/../messages/en.json");

export async function apiT(req: Request): Promise<ApiTranslator> {
  const locale = requestLocale(req);
  const messages = (await catalogs[locale]()).default as Messages;
  return createTranslator({ locale, messages, namespace: "api" });
}

export { requestLocale };
