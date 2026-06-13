import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { PawPrint } from "@/components/cat";
import { FlagFr } from "@/components/flag-fr";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    metadataBase: new URL(process.env.BASE_URL ?? "https://ppush.online"),
    title: { default: t("title"), template: t("titleTemplate") },
    description: t("description"),
    robots: { index: false, follow: false },
    openGraph: {
      title: t("title"),
      description: t("description"),
      siteName: "ppush",
      type: "website",
      locale: (await getLocale()) === "fr" ? "fr_FR" : "en_US",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "ppush" }],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: ["/og.png"],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const t = await getTranslations("footer");

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-glow">
        <NextIntlClientProvider>
          {children}
          <footer className="border-t border-line/40 py-5 text-center text-xs text-ink-faint">
            <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <a href="/about" className="transition-colors hover:text-ink-dim">
                {t("about")}
              </a>
              <span aria-hidden>·</span>
              <a href="/legal" className="transition-colors hover:text-ink-dim">
                {t("legal")}
              </a>
              <span aria-hidden>·</span>
              <a href="/privacy" className="transition-colors hover:text-ink-dim">
                {t("privacy")}
              </a>
              <span aria-hidden>·</span>
              <a href="/docs/api" className="transition-colors hover:text-ink-dim">
                {t("api")}
              </a>
              <span aria-hidden>·</span>
              <LanguageSwitcher />
            </nav>
            <p className="mt-2 inline-flex items-center gap-1.5">
              {t("tagline")} <PawPrint className="size-3 text-accent-soft/70" />
            </p>
            <p className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
              {t("network")} <span aria-hidden>·</span> {t("hostedIn")}{" "}
              <FlagFr className="h-2.5 w-auto rounded-[2px]" />
            </p>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
