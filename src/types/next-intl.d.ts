import type en from "../../messages/en.json";

/**
 * Typed translation keys: any key missing from messages/en.json is a
 * TypeScript error — impossible to forget a string, present or future.
 */
declare module "next-intl" {
  interface AppConfig {
    Messages: typeof en;
    Locale: "en" | "fr";
  }
}
