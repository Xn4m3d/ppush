import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { Geologica, Azeret_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { currentUser } from "@/lib/auth";
import { DAY_START, DAY_END, THEME_COOKIE, isThemeChoice, resolveTheme } from "@/lib/themes";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { FlagFr } from "@/components/flag-fr";
import { SourceLink } from "@/components/source-link";
import { StructuredData } from "@/components/structured-data";
import { Ambient } from "@/components/ambient";
import "./globals.css";

/* Two families: Geologica for headings and text (geometric, tight in
   heavy weights), Azeret Mono for everything technical — secrets, links,
   bytes, visualization labels. */
const geologica = Geologica({
  variable: "--font-geologica",
  subsets: ["latin"],
});

const azeret = Azeret_Mono({
  variable: "--font-azeret",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  // social preview per language: og.png (English, the default language) / og-fr.png
  const og = (await getLocale()) === "fr" ? "/og-fr.png" : "/og.png";
  return {
    metadataBase: new URL(process.env.BASE_URL ?? "https://ppush.online"),
    title: { default: t("title"), template: t("titleTemplate") },
    description: t("description"),
    // Default favicon = reference theme (midnight); the anti-flash script switches it
    // to the variant of the actually-applied theme (mecha/midnight).
    icons: { icon: [{ url: "/icon-midnight.svg", type: "image/svg+xml" }] },
    openGraph: {
      title: t("title"),
      description: t("description"),
      siteName: "ppush",
      type: "website",
      locale: (await getLocale()) === "fr" ? "fr_FR" : "en_US",
      images: [{ url: og, width: 1200, height: 630, alt: "ppush" }],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: [og],
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

  const themeCookie = (await cookies()).get(THEME_COOKIE)?.value;
  const user = await currentUser();
  const ut = user?.theme ?? null;
  // priority: explicit cookie > account preference > night ("midnight",
  // the black of the Diffusion art direction). "auto" stays an explicit choice.
  const choice = isThemeChoice(themeCookie) ? themeCookie : isThemeChoice(ut) ? ut : "midnight";
  // SSR / no-JS: "auto" rendered as the DAY theme (mecha, h=12); the inline script
  // corrects it from the visitor's LOCAL hour before first paint (zero flash).
  const theme = resolveTheme(choice, 12);
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang={locale}
      data-theme={theme}
      // The anti-flash script rewrites data-theme from the LOCAL hour before
      // hydration: the attribute is deliberately driven client-side, so we
      // don't warn about the mismatch on this node (see next-themes).
      suppressHydrationWarning
      className={`${geologica.variable} ${azeret.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Anti-flash script: applies the theme (auto → day/night based on the
            LOCAL hour) BEFORE first paint. Priority cookie > account preference > auto. */}
        <script
          nonce={nonce}
          // the browser blanks the nonce attribute once read (CSP anti-exfiltration):
          // the DOM ↔ client difference is expected, not a real mismatch
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/(?:^|; )theme=([^;]+)/);var c=m?decodeURIComponent(m[1]):"";var u=${JSON.stringify(ut ?? "")};var re=/^(midnight|mecha|auto)$/;var p=re.test(c)?c:re.test(u)?u:"midnight";var h=new Date().getHours();var t=(p==="midnight"||p==="mecha")?p:((h>=${DAY_START}&&h<${DAY_END})?"mecha":"midnight");document.documentElement.dataset.theme=t;var f=document.querySelector("link[rel~='icon']");if(f)f.href=(t==='mecha')?'/icon-mecha.svg':'/icon-midnight.svg';}catch(e){}})();`,
          }}
        />
        <Ambient />
        <StructuredData />
        <NextIntlClientProvider>
          {children}
          <footer className="border-t border-line/60 py-5 text-center text-xs text-ink-faint">
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
              <span aria-hidden>·</span>
              <ThemeSwitcher current={choice} persist={!!user} />
            </nav>
            <p className="mt-2 inline-flex items-center gap-1.5">
              {t("tagline")} <span aria-hidden className="inline-block size-1.5 rounded-full bg-accent" />
            </p>
            <p className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
              {t("network")} <span aria-hidden>·</span> {t("hostedIn")}{" "}
              <FlagFr className="h-2.5 w-auto rounded-[2px]" />
            </p>
            <div className="mt-1.5">
              <SourceLink />
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
