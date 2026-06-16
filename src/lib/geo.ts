import path from "node:path";
import maxmind, { type Reader, type CityResponse } from "maxmind";
import { config } from "./config";

/**
 * OFFLINE geolocation from a local db-ip City Lite database
 * (`data/geo/dbip-city-lite.mmdb`) — no external call (policy: no third-party
 * sharing). Read on the fly from already-stored IPs; no new data is persisted.
 * The database (~125 MB) is opened as a LAZY singleton (on first need) and
 * RELEASED when idle (see releaseGeoIfIdle), to bound RAM. Degrades gracefully
 * (null) if the file is absent.
 */
const MMDB = path.join(config.dataDir, "geo", "dbip-city-lite.mmdb");
const IDLE_MS = 20 * 60_000;

let reader: Reader<CityResponse> | null = null;
let loading: Promise<Reader<CityResponse> | null> | null = null;
let lastUsed = 0;

async function getReader(): Promise<Reader<CityResponse> | null> {
  lastUsed = Date.now();
  if (reader) return reader;
  if (!loading) {
    loading = maxmind
      .open<CityResponse>(MMDB)
      .then((r) => (reader = r))
      .catch(() => null)
      .finally(() => {
        loading = null;
      });
  }
  return loading;
}

/** Releases the database if unused for IDLE_MS — called by the sweeper. */
export function releaseGeoIfIdle(): void {
  if (reader && Date.now() - lastUsed > IDLE_MS) reader = null;
}

export type Geo = {
  country: string;
  countryName: string;
  city: string | null;
  lat: number | null;
  lon: number | null;
};

function isPrivate(ip: string): boolean {
  return (
    !ip ||
    ip === "::1" ||
    ip.startsWith("127.") ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith("fe80:") ||
    ip.startsWith("fc") ||
    ip.startsWith("fd") ||
    ip.startsWith("::ffff:127.") ||
    ip.startsWith("::ffff:10.") ||
    ip.startsWith("::ffff:192.168.")
  );
}

export async function geoLookup(ip: string | null): Promise<Geo | null> {
  if (!ip || isPrivate(ip)) return null;
  const r = await getReader();
  if (!r) return null;
  try {
    const m = r.get(ip.replace(/^::ffff:/i, ""));
    const code = m?.country?.iso_code;
    if (!code) return null;
    return {
      country: code,
      countryName: m.country?.names?.en ?? code,
      city: m.city?.names?.en ?? null,
      lat: m.location?.latitude ?? null,
      lon: m.location?.longitude ?? null,
    };
  } catch {
    return null;
  }
}

export async function geoAvailable(): Promise<boolean> {
  return (await getReader()) !== null;
}
