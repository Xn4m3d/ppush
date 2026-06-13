"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Lightbulb, History, Eye, FileUp, Fingerprint } from "lucide-react";

const PERKS = [
  { icon: History, key: "perk1" },
  { icon: Eye, key: "perk2" },
  { icon: FileUp, key: "perk3" },
  { icon: Fingerprint, key: "perk4" },
] as const;

/** Registration welcome panel: account perks + a random tip. */
export function RegisterAside() {
  const t = useTranslations("auth");
  return (
    <aside className="w-full max-w-md space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t("perksTitle")}</h2>
        <ul className="mt-3 space-y-2.5">
          {PERKS.map(({ icon: Icon, key }) => (
            <li key={key} className="flex items-start gap-2.5 text-sm text-ink-dim">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border border-accent/25 bg-accent/10">
                <Icon className="size-3.5 text-accent-soft" />
              </span>
              {t(key)}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-faint">{t("perksFree")}</p>
      </div>
      <TipCard />
    </aside>
  );
}

/** ppush / security tip, picked at random then refreshed every 8 s. */
function TipCard() {
  const t = useTranslations("tips");
  const list = t.raw("list") as string[];
  const [i, setI] = useState<number | null>(null);

  useEffect(() => {
    // draws in async callbacks: no hydration mismatch nor synchronous setState
    // in the effect (lint react-hooks/set-state-in-effect).
    const pick = () =>
      setI((prev) => {
        let n = Math.floor(Math.random() * list.length);
        if (prev !== null && n === prev) n = (n + 1) % list.length;
        return n;
      });
    const first = setTimeout(pick, 0);
    const id = setInterval(pick, 8000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [list.length]);

  return (
    <div className="rounded-2xl border border-line bg-panel/40 p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-accent-soft">
        <Lightbulb className="size-3.5" /> {t("label")}
      </p>
      <p
        key={i ?? -1}
        className="mt-1.5 min-h-[2.75rem] text-sm leading-relaxed text-ink-dim animate-fade-up"
      >
        {i === null ? "" : list[i]}
      </p>
    </div>
  );
}
