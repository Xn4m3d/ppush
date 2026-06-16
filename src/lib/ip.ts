/**
 * IP anonymization for display to a push's CREATOR (a recipient's IP is a third
 * party's personal data → GDPR minimization).
 * IPv4 → /24 (last octet zeroed), IPv6 → /48. Standard "IP anonymization"
 * (Google Analytics, Matomo). Keeps the approximate geo, removes the individual.
 * Display only: the full IP stays stored (admin + legal retention).
 */
export function maskIp(ip: string | null | undefined): string | null {
  if (!ip) return ip ?? null;
  const mapped = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  const v4 = mapped ? mapped[1] : ip;
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v4)) {
    const p = v4.split(".");
    return `${p[0]}.${p[1]}.${p[2]}.0`;
  }
  if (ip.includes(":")) {
    const segs = ip.split(":").filter((_, i) => i < 3);
    return segs.join(":") + "::";
  }
  return ip;
}
