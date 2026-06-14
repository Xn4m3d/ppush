import { getTranslations } from "next-intl/server";

const REPO = "https://github.com/Xn4m3d/ppush";

/** GitHub mark (inline SVG — lucide-react no longer ships brand icons). */
function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 .5C5.37.5 0 5.78 0 12.29c0 5.2 3.44 9.62 8.21 11.18.6.11.82-.26.82-.58 0-.28-.01-1.02-.02-2-3.34.72-4.04-1.6-4.04-1.6-.55-1.38-1.34-1.75-1.34-1.75-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.23 1.84 1.23 1.07 1.83 2.81 1.3 3.5.99.11-.77.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 016 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.82 1.1.82 2.22 0 1.61-.02 2.9-.02 3.29 0 .32.22.69.83.57C20.56 21.91 24 17.49 24 12.29 24 5.78 18.63.5 12 .5z" />
    </svg>
  );
}

/**
 * Link to the source code (transparency) + version currently LIVE.
 * APP_VERSION / APP_SHA are injected at build time by CI (see Dockerfile);
 * in a local build the version is "dev" and links to the repository.
 * SERVER component: no client import (e.g. cls) — direct string concatenation.
 */
export async function SourceLink({ className = "" }: { className?: string }) {
  const t = await getTranslations("footer");
  const version = process.env.APP_VERSION || "dev";
  const sha = process.env.APP_SHA || "";
  const buildHref = version === "dev" ? REPO : `${REPO}/releases/tag/${version}`;
  const buildTitle = sha ? `${t("buildTooltip")} · ${sha.slice(0, 7)}` : t("buildTooltip");

  return (
    <span
      className={`inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-ink-faint ${className}`}
    >
      <a
        href={REPO}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 transition-colors hover:text-ink-dim"
      >
        <GithubMark className="size-3.5" /> {t("source")}
      </a>
      <span aria-hidden>·</span>
      <a
        href={buildHref}
        target="_blank"
        rel="noopener noreferrer"
        title={buildTitle}
        className="font-mono transition-colors hover:text-ink-dim"
      >
        {version}
      </a>
    </span>
  );
}
