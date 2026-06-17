"use client";

import { useTranslations } from "next-intl";
import { cls } from "../ui";
import { WORLD_LAND } from "./world-land";

type City = { city: string | null; country: string; lat: number; lon: number; count: number };
type Country = { code: string; name: string; count: number };

/** Emoji flag from an ISO-2 code (regional indicators). */
function flag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "🏳️";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/**
 * "Activity" world map: equirectangular projection (viewBox 360×180), light
 * graticule + glowing city dots (size ∝ √connections). Pure SVG, no tiles or
 * dependencies. Alongside: top countries (flag + bar).
 */
export function WorldMap({
  countries,
  cities,
  available,
  located,
  unlocated,
  mode,
  onMode,
}: {
  countries: Country[];
  cities: City[];
  available: boolean;
  located: number;
  unlocated: number;
  mode: string;
  onMode: (m: string) => void;
}) {
  const t = useTranslations("admin");
  const maxCity = Math.max(1, ...cities.map((c) => c.count));
  const meridians = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
  const parallels = [-60, -30, 30, 60];

  return (
    <div className="rounded-2xl border border-line bg-panel/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          {t("mapTitle")} <span className="ml-1 normal-case text-ink-faint/70">· {t("mapLast30")}</span>
        </p>
        <div className="flex items-center gap-1">
          {(
            [
              ["activity", t("modeActivity")],
              ["creations", t("modeCreations")],
            ] as [string, string][]
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => onMode(val)}
              className={cls(
                "rounded-lg px-2.5 py-1 text-xs transition-colors cursor-pointer",
                mode === val ? "bg-accent/15 text-accent-soft" : "text-ink-faint hover:bg-bg-soft hover:text-ink-dim"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!available ? (
        <p className="mt-3 rounded-xl border border-warn/25 bg-warn/5 px-4 py-3 text-sm text-ink-dim">
          {t("mapUnavailable")}
        </p>
      ) : (
        <>
        <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_240px]">
          <div className="relative overflow-hidden rounded-xl border border-line bg-bg-soft/30">
            <svg viewBox="0 0 360 180" className="block w-full" role="img" aria-label={t("mapTitle")}>
              <defs>
                <filter id="ppush-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="1.4" />
                </filter>
              </defs>
              {meridians.map((m) => (
                <line key={`m${m}`} x1={m + 180} y1={0} x2={m + 180} y2={180} stroke="var(--color-line)" strokeWidth="0.15" />
              ))}
              {parallels.map((p) => (
                <line key={`p${p}`} x1={0} y1={90 - p} x2={360} y2={90 - p} stroke="var(--color-line)" strokeWidth="0.15" />
              ))}
              <line x1={0} y1={90} x2={360} y2={90} stroke="var(--color-line-soft)" strokeWidth="0.25" />
              {/* continent silhouette (Natural Earth 110m) */}
              <path
                d={WORLD_LAND}
                fill="var(--color-line-soft)"
                fillRule="evenodd"
                opacity={0.7}
                stroke="var(--color-line-soft)"
                strokeWidth={0.12}
              />
              {cities.map((c, i) => {
                const x = c.lon + 180;
                const y = 90 - c.lat;
                const r = 0.7 + Math.sqrt(c.count / maxCity) * 3.4;
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r={r * 1.9} fill="var(--color-accent)" opacity={0.22} filter="url(#ppush-glow)" />
                    <circle cx={x} cy={y} r={r} fill="var(--color-accent-soft)">
                      <title>{`${c.city ?? "?"}, ${c.country} · ${c.count}`}</title>
                    </circle>
                  </g>
                );
              })}
            </svg>
            {cities.length === 0 && (
              <p className="absolute inset-0 grid place-items-center px-4 text-center text-xs text-ink-faint">
                {t("mapEmpty")}
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs text-ink-faint">{t("mapTopCountries")}</p>
            <ul className="space-y-1.5">
              {countries.slice(0, 8).map((c) => {
                const pct = countries[0] ? Math.round((c.count / countries[0].count) * 100) : 0;
                return (
                  <li key={c.code} className="flex items-center gap-2 text-sm">
                    <span className="w-5 shrink-0 text-base leading-none">{flag(c.code)}</span>
                    <span className="w-24 shrink-0 truncate text-ink-dim">{c.name}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-soft">
                      <span className="block h-full rounded-full bg-accent/70" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-8 shrink-0 text-right tabular-nums text-ink-faint">{c.count}</span>
                  </li>
                );
              })}
              {countries.length === 0 && <li className="text-xs text-ink-faint">{t("mapEmpty")}</li>}
            </ul>
            <p className="mt-3 border-t border-line/60 pt-2 text-[11px] text-ink-faint">
              {t("mapLocated", { located, unlocated })}
            </p>
          </div>
        </div>
        {/* Geo source credit (DB-IP Lite, CC-BY) — admin map only */}
        <p className="mt-2 text-right text-[10px] text-ink-faint/70">
          <a
            href="https://db-ip.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink-faint hover:underline"
          >
            {t("mapCredit")}
          </a>
        </p>
        </>
      )}
    </div>
  );
}
