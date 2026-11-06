import type { ReactNode } from "react";
import { config } from "@/lib/config";

/**
 * Shared head of the inner pages: technical eyebrow, title, lede,
 * optional figures. Clear glass: space shows behind it, only a grid
 * of dots is etched on it. Mono legend at the bottom right: `cap`, or the page's
 * address when `path` is given.
 */
export function PageHead({
  eyebrow,
  title,
  lede,
  meta,
  cap,
  path,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  meta?: ReactNode;
  cap?: ReactNode;
  path?: string;
}) {
  const legend = cap ?? (path ? `${new URL(config.baseUrl).host}${path}` : null);
  return (
    <section className="phead">
      <div className="wrap phead-in">
        <div className="ph-text">
          <p className="eyebrow ph-eyebrow">{eyebrow}</p>
          <h1 className="ph-title">{title}</h1>
          {lede && <div className="ph-lede">{lede}</div>}
          {meta && <p className="ph-meta">{meta}</p>}
        </div>
        {legend && <p className="ph-cap">{legend}</p>}
      </div>
    </section>
  );
}
