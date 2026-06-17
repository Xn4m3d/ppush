"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, cls } from "../ui";
import { BarChart } from "./charts";
import { WorldMap } from "./world-map";
import type { Locale } from "@/i18n/locale";

type Insights = {
  timeseries: { date: string; pushes: number; views: number; signups: number }[];
  granularity: "day" | "week" | "month";
  geo: {
    available: boolean;
    countries: { code: string; name: string; count: number }[];
    cities: { city: string | null; country: string; lat: number; lon: number; count: number }[];
    located: number;
    unlocated: number;
  };
};

export function OverviewTab({ refreshKey }: { refreshKey: number }) {
  const t = useTranslations("admin");
  const locale = useLocale() as Locale;
  const [range, setRange] = useState("30");
  const [geoMode, setGeoMode] = useState("activity");
  const [data, setData] = useState<Insights | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/insights?range=${range}&mode=${geoMode}`).then(async (r) => {
      if (r.ok && !cancelled) setData(await r.json());
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, range, geoMode]);

  const series = data?.timeseries ?? [];
  const gran = data?.granularity ?? "day";
  const sum = (k: "pushes" | "views" | "signups") => series.reduce((a, d) => a + d[k], 0);

  const fmt = (iso: string) => {
    const d = new Date(iso + "T00:00:00Z");
    return gran === "month"
      ? d.toLocaleDateString(locale, { month: "short", year: "numeric", timeZone: "UTC" })
      : d.toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  };
  const granLabel = t(gran === "month" ? "granMonth" : gran === "week" ? "granWeek" : "granDay");

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{t("trends")}</p>
          <div className="flex flex-wrap items-center gap-1">
            {(
              [
                ["7", t("range7")],
                ["30", t("range30")],
                ["90", t("range90")],
                ["365", t("range365")],
                ["all", t("rangeAll")],
              ] as [string, string][]
            ).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setRange(val)}
                className={cls(
                  "rounded-lg px-2.5 py-1 text-xs transition-colors cursor-pointer",
                  range === val ? "bg-accent/15 text-accent-soft" : "text-ink-faint hover:bg-bg-soft hover:text-ink-dim"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <BarChart
            data={series.map((d) => d.pushes)}
            label={t("chartPushes")}
            hint={t("chartPushesHint")}
            total={sum("pushes")}
            tone="accent"
          />
          <BarChart
            data={series.map((d) => d.views)}
            label={t("chartViews")}
            hint={t("chartViewsHint")}
            total={sum("views")}
            tone="ok"
          />
          <BarChart
            data={series.map((d) => d.signups)}
            label={t("chartSignups")}
            hint={t("chartSignupsHint")}
            total={sum("signups")}
            tone="ink"
          />
        </div>

        {series.length > 0 && (
          <p className="mt-2 flex items-center justify-between text-[11px] text-ink-faint">
            <span>{fmt(series[0].date)}</span>
            <span className="uppercase tracking-wide">{granLabel}</span>
            <span>{fmt(series[series.length - 1].date)}</span>
          </p>
        )}
      </Card>

      {data && (
        <WorldMap
          countries={data.geo.countries}
          cities={data.geo.cities}
          available={data.geo.available}
          located={data.geo.located}
          unlocated={data.geo.unlocated}
          mode={geoMode}
          onMode={setGeoMode}
        />
      )}
    </div>
  );
}
