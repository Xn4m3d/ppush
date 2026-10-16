/** Publisher/host identity — single source for /legal, /privacy, /about. */
export const legal = {
  editorName: "Alexandre Lamata",
  editorCity: "Cagnes-sur-Mer",
  editorCountry: "France",
  contactEmail: "contact@ppush.online",
  /** Network technical intermediary (CDN/proxy/tunnel) — only sees ciphertext. */
  cdn: "Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, USA",
  updatedFr: "12 juin 2026",
  updatedEn: "June 12, 2026",
  // Privacy page: dated separately (cookies section reviewed on October 16, 2026)
  privacyUpdatedFr: "16 octobre 2026",
  privacyUpdatedEn: "October 16, 2026",
} as const;
