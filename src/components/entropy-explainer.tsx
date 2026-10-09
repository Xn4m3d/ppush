"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MorphDialog, requestMorphClose } from "./morph-dialog";
import { Button } from "./ui";

// Table references: recommended threshold (CNIL/ANSSI) and measured attack
// speed (hashcat, RTX 4090: ~150 GH/s on MD5, ~200 kH/s on bcrypt).
const SOURCES = [
  { key: "srcAnssi", href: "https://cyber.gouv.fr/publications/recommandations-relatives-lauthentification-multifacteur-et-aux-mots-de-passe" },
  { key: "srcCnil", href: "https://www.cnil.fr/sites/cnil/files/atoms/files/deliberation-2022-100-du-21-juillet-2022_recommandation-aux-mots-de-passe.pdf" },
  { key: "srcHashcat", href: "https://hashcat.net/forum/post-56468.html" },
] as const;

/**
 * "What is entropy?" — a discreet control next to the slogan that opens a
 * short explanation (window morphing out of it). Ties the slogan to
 * the generator's strength indicator: the site explains rather than imposes.
 * The table's orders of magnitude are computed for the French list
 * (~12.6 bits/word) at 10^11 guesses/s (one RTX 4090 against MD5).
 */
export function EntropyExplainer({ variant = "link" }: { variant?: "link" | "icon" }) {
  const t = useTranslations("entropy");
  const [open, setOpen] = useState(false);
  const link = useRef<HTMLButtonElement>(null);
  const b = (c: React.ReactNode) => <b className="font-semibold text-ink">{c}</b>;
  const rows = [
    ["r1", "r1v", "r1t", "text-warn"],
    ["r2", "r2v", "r2t", "text-ink"],
    ["r3", "r3v", "r3t", "text-ok"],
  ] as const;

  return (
    <>
      {variant === "icon" ? (
        // just a circled "?" next to the word: the question lives in the tooltip
        <button
          ref={link}
          type="button"
          aria-haspopup="dialog"
          aria-label={t("link")}
          title={t("link")}
          onClick={() => setOpen(true)}
          className="ml-1.5 inline-grid size-[0.62em] min-h-6 min-w-6 translate-y-[-0.42em] place-items-center rounded-full border-2 border-accent/70 align-middle font-sans text-[0.38em] font-bold leading-none text-accent transition-colors hover:bg-accent hover:text-[var(--on-accent)] cursor-pointer"
        >
          ?
        </button>
      ) : (
        <button
          ref={link}
          type="button"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 font-medium text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent cursor-pointer"
        >
          <span aria-hidden className="grid size-4 place-items-center rounded-full border border-accent/60 text-[10px] leading-none no-underline">?</span>
          {t("link")}
        </button>
      )}
      <MorphDialog open={open} onClose={() => setOpen(false)} anchorRef={link} labelledBy="entropy-title" className="w-[min(620px,calc(100vw-32px))]">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 id="entropy-title" className="text-lg font-bold">{t("title")}</h2>
          <button type="button" onClick={(e) => requestMorphClose(e.currentTarget)} aria-label={t("close")} className="grid size-8 place-items-center rounded-lg text-ink-dim hover:bg-panel hover:text-ink cursor-pointer">✕</button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-auto px-5 py-3.5 text-[14px] leading-relaxed text-ink-dim">
          {(["s1", "s2", "s3"] as const).map((k, i) => (
            <section key={k} className="flex gap-3">
              <span className="mt-0.5 font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="mb-0.5 text-[14px] font-semibold text-ink">{t(`${k}t`)}</h3>
                <p className="m-0">{t.rich(k, { b })}</p>
              </div>
            </section>
          ))}
          <figure className="m-0 rounded-xl border border-line bg-panel px-4 py-2.5">
            <figcaption className="eyebrow mb-2">{t("tableCaption")}</figcaption>
            <table className="w-full text-sm">
              <tbody>
                {rows.map(([l, v, d, tone]) => (
                  <tr key={l} className="border-t border-line first:border-t-0">
                    <td className="py-1 pr-3 text-ink">{t(l)}</td>
                    <td className="py-1 pr-3 font-mono text-xs text-ink-faint tabular-nums">{t(v)}</td>
                    <td className={`py-1 text-right font-semibold ${tone}`}>{t(d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-ink-faint">{t("tableNote")}</p>
            <p className="mt-1.5 text-xs text-ink-faint">
              {t("sources")} :{" "}
              {SOURCES.map(({ key, href }, i) => (
                <span key={key}>
                  {i > 0 && " · "}
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-ink-dim underline underline-offset-2 hover:text-ink">
                    {t(key)}
                  </a>
                </span>
              ))}
            </p>
          </figure>
          <section className="flex gap-3">
            <span className="mt-0.5 font-mono text-xs text-accent">04</span>
            <div>
              <h3 className="mb-0.5 text-[14px] font-semibold text-ink">{t("s4t")}</h3>
              <p className="m-0">{t("s4")}</p>
            </div>
          </section>
        </div>
        <div className="flex justify-end border-t border-line px-5 py-3">
          <Button type="button" onClick={(e) => requestMorphClose(e.currentTarget)} className="min-h-10 px-6">{t("done")}</Button>
        </div>
      </MorphDialog>
    </>
  );
}
