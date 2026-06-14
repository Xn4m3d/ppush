import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { config } from "@/lib/config";

/**
 * JSON-LD structured data (WebSite + Organization + SoftwareApplication), rendered
 * site-wide from the root layout. The <script> tag carries the CSP nonce (the
 * `x-nonce` request header set by the middleware): the strict `script-src` — without
 * `unsafe-inline` — would otherwise block this inline block in the browser.
 */
export async function StructuredData() {
  const t = await getTranslations("meta");
  const locale = await getLocale();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const base = config.baseUrl;
  const name = "ppush";
  const description = t("description");

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${base}/#website`,
        name,
        url: base,
        description,
        inLanguage: locale,
        publisher: { "@id": `${base}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${base}/#organization`,
        name,
        url: base,
        logo: `${base}/og.png`,
      },
      {
        "@type": "SoftwareApplication",
        name,
        url: base,
        applicationCategory: "SecurityApplication",
        operatingSystem: "Web",
        description,
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
      },
    ],
  };

  // Trusted content (i18n strings + config, no user input), but we escape `<` as a
  // precaution to prevent any </script> tag breakout.
  const json = JSON.stringify(graph).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
