"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Download, Flame, ExternalLink, AlertTriangle, Eye, EyeOff } from "lucide-react";
import {
  importKey,
  decryptPayload,
  decryptFileStream,
  fromB64Url,
  type SecretPayload,
} from "@/lib/crypto";
import { formatBytes } from "@/lib/format";
import type { Locale } from "@/i18n/locale";
import { Button, Input, ErrorText, CondenseLoader, cls } from "./ui";
import { CopyButton } from "./copy-button";
import { DiffusionScene } from "./diffusion/scene";

type Meta = {
  slug: string;
  kind: string;
  expired: boolean;
  retrievalStep: boolean;
  deletableByViewer: boolean;
  hasPassphrase: boolean;
  fileSize: number | null;
  expiresAt: string;
  viewsLeft?: number;
};

type Stage =
  | "loading"
  | "expired"
  | "no-key"
  | "gate" // passphrase and/or retrieval step
  | "revealing"
  | "revealed"
  | "wiped"
  | "burned"
  | "error";

const WIDE = "(min-width: 1024px)";
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Reception page. The cloud on the right is the encrypted secret waiting
 * on the server; on open, it takes the shape of the real ciphertext received, then
 * condenses back into readable characters in the left panel.
 */
export function SecretViewer({ slug, autoOpen = false }: { slug: string; autoOpen?: boolean }) {
  const t = useTranslations("viewer");
  const tr = useTranslations("receive");
  const tTabs = useTranslations("tabs");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [stage, setStage] = useState<Stage>("loading");
  const [keyB64, setKeyB64] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<SecretPayload | null>(null);
  const [viewToken, setViewToken] = useState<string | null>(null);
  const [deletable, setDeletable] = useState(false);
  const [dlProgress, setDlProgress] = useState<number | null>(null);
  const [formed, setFormed] = useState(false);
  const [lastView, setLastView] = useState(false);

  // ---- visualisation ----
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cloudRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLElement | null>(null);
  const scene = useRef<DiffusionScene | null>(null);
  const cipherRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    const host = hostRef.current, canvas = canvasRef.current;
    if (!host || !canvas) return;
    const sc = new DiffusionScene({
      direction: "in",
      host,
      canvas,
      cloud: () => cloudRef.current,
      anchor: () => actionRef.current,
      stacked: () => !window.matchMedia(WIDE).matches,
    });
    scene.current = sc;
    return () => { sc.destroy(); scene.current = null; };
  }, []);

  // the cloud appears as soon as we know the secret is waiting on the server
  useEffect(() => {
    const sc = scene.current;
    if (!sc || !meta) return;
    const raf = requestAnimationFrame(() => {
      sc.layout();
      if (meta.expired) sc.clear();
      else sc.seedCloud(slug, Math.min(96, 24 + Math.round((meta.fileSize ?? 0) / 4096)));
    });
    return () => cancelAnimationFrame(raf);
  }, [meta, slug]);

  // after display: the cloud writes the secret, then fades (or re-forms
  // if views remain: the encrypted block is still on the server)
  useEffect(() => {
    if (stage !== "revealed") return;
    const sc = scene.current;
    let t1: ReturnType<typeof setTimeout> | undefined, t2: ReturnType<typeof setTimeout> | undefined;
    const raf = requestAnimationFrame(() => {
      if (!sc) { setFormed(true); return; }
      sc.layout();
      if (cipherRef.current) sc.reshape(cipherRef.current);
      t1 = setTimeout(() => {
        if (textRef.current) sc.condense(textRef.current);
        if (!window.matchMedia(WIDE).matches) textRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        t2 = setTimeout(() => {
          sc.settle();
          setFormed(true);
          if (!lastView) setTimeout(() => scene.current?.seedCloud(slug, 48), 900);
        }, reduced() ? 0 : 1800);
      }, reduced() ? 0 : 350);
    });
    return () => { cancelAnimationFrame(raf); if (t1) clearTimeout(t1); if (t2) clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // switch the screen to "expired" when the countdown reaches zero
  const expire = useCallback(() => { setStage("expired"); scene.current?.clear(); }, []);

  const reveal = useCallback(
    async (metaArg?: Meta, keyArg?: string) => {
      const m = metaArg ?? meta;
      const k = keyArg ?? keyB64;
      if (!m) return;
      setError("");
      setStage("revealing");
      try {
        const res = await fetch(`/api/p/${slug}/reveal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(m.hasPassphrase ? { passphrase } : {}),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 410) { scene.current?.clear(); return setStage("expired"); }
          setError(data.error ?? t("serverError"));
          return setStage("gate");
        }
        const key = await importKey(k);
        const bytes = fromB64Url(
          data.ciphertext.replace(/\+/g, "-").replace(/\//g, "_")
        );
        const decrypted = await decryptPayload(key, bytes);
        cipherRef.current = bytes;
        setLastView((m.viewsLeft ?? 1) <= 1);
        setPayload(decrypted);
        setViewToken(data.viewToken ?? null);
        setDeletable(data.deletableByViewer);
        setFormed(false);
        setStage("revealed");
      } catch {
        setError(t("decryptFailed"));
        setStage("gate");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [meta, slug, passphrase, keyB64]
  );

  useEffect(() => {
    let cancelled = false;
    const hash = window.location.hash.slice(1);

    fetch(`/api/p/${slug}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setStage(res.status === 404 ? "expired" : "error");
          return;
        }
        const m: Meta = await res.json();
        setMeta(m);
        setKeyB64(hash);
        if (m.expired) return setStage("expired");
        if (!hash) return setStage("no-key");
        try {
          if (fromB64Url(hash).length !== 32) return setStage("no-key");
        } catch {
          return setStage("no-key");
        }
        // no retrieval step or passphrase → direct reveal
        if (!m.retrievalStep && !m.hasPassphrase) {
          reveal(m, hash);
        } else {
          setStage("gate");
        }
      })
      .catch(() => {
        if (!cancelled) setStage("error");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function downloadFile() {
    if (!payload || !viewToken) return;
    setDlProgress(0);
    setError("");
    try {
      const key = await importKey(keyB64);
      // the token goes in a header, never in the URL: query strings end up in
      // access logs, `Referer` and browser history
      const res = await fetch(`/api/p/${slug}/blob`, {
        headers: { "x-view-token": viewToken },
      });
      if (!res.ok || !res.body) throw new Error("download");
      const blob = await decryptFileStream(key, res.body, payload.mime ?? "", (b) =>
        setDlProgress(payload.size ? Math.min(100, Math.round((b / payload.size) * 100)) : 0)
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = payload.name ?? "file";
      a.click();
      URL.revokeObjectURL(url);
      setDlProgress(100);
    } catch {
      setError(t("downloadFailed"));
      setDlProgress(null);
      // The token is single-use and was burned when the transfer started, so a
      // retry needs a fresh one. The server knows this view is still owed a
      // delivery and re-issues without charging another view — re-arm so the
      // button works again instead of staying inert.
      setViewToken(null);
      reveal();
    }
  }

  async function burn() {
    if (!confirm(t("burnConfirm"))) return;
    const res = await fetch(`/api/p/${slug}/burn`, { method: "POST" });
    if (res.ok) { setStage("burned"); scene.current?.clear(); }
  }

  // ---- left column, by state ----
  const last = (meta?.viewsLeft ?? 1) <= 1;
  let left: React.ReactNode;

  if (stage === "loading") {
    left = <div className="py-16"><CondenseLoader /></div>;
  } else if (stage === "expired" || stage === "burned") {
    left = (
      <View eyebrow={tr("goneEyebrow")} title={stage === "burned" ? t("burnedTitle") : t("expiredTitle")}>
        <p className="max-w-[48ch] text-[17px] text-ink-dim">{stage === "burned" ? t("burnedBody") : t("expiredBody")}</p>
        {stage === "expired" && <p className="max-w-[52ch] text-sm text-ink-faint">{tr("goneHint")}</p>}
      </View>
    );
  } else if (stage === "no-key") {
    left = (
      <View eyebrow={tr("goneEyebrow")} title={t("noKeyTitle")}>
        <p className="max-w-[52ch] text-[17px] text-ink-dim">{t.rich("noKeyBody", { code: (c) => <code className="font-mono text-ink">{c}</code> })}</p>
      </View>
    );
  } else if (stage === "error") {
    left = <View eyebrow={tr("eyebrow")} title={t("serverError")} />;
  } else if (stage === "wiped") {
    left = (
      <View eyebrow={tr("wipedEyebrow")} title={lastView ? tr("wipedTitleLast") : tr("wipedTitle")} ok>
        <p className="text-[17px] text-ink-dim">{tr("wipedBody")}</p>
      </View>
    );
  } else if (stage === "gate" || stage === "revealing") {
    left = (
      <View eyebrow={tr("eyebrow")} title={tr("title")}>
        <p className="-mt-1 max-w-[46ch] text-[17px] text-ink-dim">
          {tr.rich(last ? "ledeOnce" : "ledeMany", { b: (c) => <b className="font-medium text-ink">{c}</b> })}
        </p>
        {meta && (
          <ul className="grid grid-cols-3 overflow-hidden rounded-2xl border border-line">
            <Fact label={tr("factKind")} value={tTabs(meta.kind as "PASSWORD")} />
            <Fact label={tr("factExpires")} value={<Remaining expiresAt={meta.expiresAt} onExpire={expire} />} />
            <Fact label={tr("factViews")} value={tr("viewsLeft", { count: meta.viewsLeft ?? 1 })} />
          </ul>
        )}
        {meta?.hasPassphrase && (
          <label className="flex flex-col gap-2">
            <span className="eyebrow">{tr("passLabel")}</span>
            <Input
              type="password"
              value={passphrase}
              onChange={(e) => { setPassphrase(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && passphrase && reveal()}
              placeholder={tr("passPlaceholder")}
              className={cls("min-h-14 text-[17px] sm:text-[17px]", error && "border-accent")}
              autoFocus
            />
          </label>
        )}
        <ErrorText>{error}</ErrorText>
        <Button
          ref={actionRef}
          onClick={() => reveal()}
          loading={stage === "revealing"}
          className="min-h-14 w-full text-base"
          disabled={meta?.hasPassphrase && !passphrase}
        >
          <Eye className="size-4" />
          {t("reveal")}
        </Button>
        <p className="text-sm text-ink-faint">{last ? tr("revealHintLast") : tr("revealHint")}</p>
        <details className="border-t border-line pt-3 text-sm text-ink-dim">
          <summary className="cursor-pointer font-medium text-ink">{tr("unsure")}</summary>
          <p className="mt-2 max-w-[52ch]">{tr("unsureBody")}</p>
        </details>
      </View>
    );
  } else {
    // revealed
    left = (
      <View eyebrow={lastView ? tr("shownEyebrowLast") : tr("shownEyebrow")} title={tr("shownTitle")} ok>
        <div className="flex flex-col gap-3.5 rounded-2xl border border-line bg-panel p-4 sm:p-5">
          {payload?.t === "URL" ? (
            <UrlReveal url={payload.d} autoOpen={autoOpen && formed} formed={formed} textRef={textRef} />
          ) : payload?.t === "FILE" ? (
            <FileReveal payload={payload} formed={formed} textRef={textRef} progress={dlProgress} onDownload={downloadFile} />
          ) : (
            <SecretBox value={payload?.d ?? ""} formed={formed} textRef={textRef} />
          )}
        </div>
        <div className={cls("flex flex-col gap-3.5 transition-[opacity,transform] delay-100 duration-500", formed ? "opacity-100" : "translate-y-1.5 opacity-0")}>
          <ErrorText>{error}</ErrorText>
          <p className="rounded-[10px] bg-accent/10 px-3.5 py-3 text-[15px] text-ink">{lastView ? tr("copyNowLast") : tr("copyNow")}</p>
          {lastView && (
            <p className="flex items-start gap-2.5 text-[15px] text-ink-dim">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="mt-1 flex-none text-ok">
                <circle cx="8" cy="8" r="7.5" fill="none" stroke="currentColor" />
                <path d="M4.5 8.2l2.3 2.3 4.7-4.9" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              {tr("goneServer")}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Button variant="ghost" onClick={() => { setPayload(null); setStage("wiped"); }}>
              {tr("wipe")}
            </Button>
            {deletable && !lastView && (
              <button onClick={burn} className="inline-flex items-center gap-1.5 text-sm font-medium text-danger hover:text-danger/80 cursor-pointer">
                <Flame className="size-3.5" />
                {t("burnAction")}
              </button>
            )}
          </div>
        </div>
      </View>
    );
  }

  const serverEmpty = stage === "expired" || stage === "burned" || stage === "no-key" || stage === "wiped" || (stage === "revealed" && lastView && formed);

  return (
    <div ref={hostRef} className="relative mx-auto w-full max-w-6xl flex-1 px-4 pb-10 pt-6 sm:px-6">
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 z-[6] h-full w-full" />
      <div className="grid gap-x-16 gap-y-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.1fr)]">
        <div className="relative z-[4] min-w-0">
          {left}
          <p className="mt-6 text-sm text-ink-faint">
            {tr.rich("footCta", { link: (c) => <Link href="/" className="font-medium text-ink-dim underline underline-offset-2 hover:text-ink">{c}</Link> })}
          </p>
        </div>
        <section aria-label={tr("zoneAria")} className="relative z-[4] order-first flex min-h-[200px] min-w-0 flex-col lg:order-none lg:min-h-[460px]">
          <div className="flex justify-between gap-3 eyebrow">
            <span>{serverEmpty ? tr("zoneGone") : tr("zone")}</span>
            <span className="text-accent">AES-256-GCM</span>
          </div>
          <div ref={cloudRef} className="grid min-h-[150px] flex-1 place-items-center">
            <p className={cls("text-[15px] text-ink-faint transition-opacity duration-700", serverEmpty ? "opacity-100" : "opacity-0")}>
              {tr("zoneGone")}
            </p>
          </div>
          {!serverEmpty && (
            <div className="hidden flex-col gap-1 border-t border-line pt-3 font-mono text-xs text-ink-faint lg:flex">
              <span>{tr("metaUnreadable")}</span>
              <span>{tr("metaKey")}</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function View({ eyebrow, title, ok, children }: { eyebrow: string; title: string; ok?: boolean; children?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 animate-fade-up">
      <p className={cls("eyebrow !text-accent", ok && "!text-ok")}>{eyebrow}</p>
      <h1 className="text-[clamp(28px,3.3vw,42px)] font-bold leading-[1.05]">{title}</h1>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <li className="flex min-w-0 flex-col gap-0.5 border-l border-line px-3 py-2.5 first:border-l-0 sm:px-3.5 sm:py-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint sm:text-[11px]">{label}</span>
      <b className="text-[15px] font-medium tabular-nums sm:text-[17px]">{value}</b>
    </li>
  );
}

/** Time left before expiry; switches the screen to "expired" at zero. */
function Remaining({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const td = useTranslations("diffusion");
  // spelled out for the recipient: "1 day", "5 hours"
  const longDelay = (ms: number) => {
    const min = Math.ceil(ms / 60_000);
    if (min < 1440) return td("dHour", { n: Math.ceil(min / 60) });
    return td("dDay", { n: Math.floor(min / 1440) });
  };
  const target = new Date(expiresAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (target - n <= 0) { clearInterval(id); onExpire(); }
    }, 1000);
    return () => clearInterval(id);
  }, [target, onExpire]);
  const left = Math.max(0, target - now);
  if (left < 3_600_000) {
    const m = Math.floor(left / 60_000), s = Math.floor(left / 1000) % 60;
    return <span className={left < 300_000 ? "text-danger" : "text-warn"}>{`${m}:${String(s).padStart(2, "0")}`}</span>;
  }
  return <>{longDelay(left)}</>;
}

function SecretBox({ value, formed, textRef }: { value: string; formed: boolean; textRef: React.RefObject<HTMLElement | null> }) {
  const t = useTranslations("viewer");
  const tr = useTranslations("receive");
  const [masked, setMasked] = useState(false);
  return (
    <>
      <p
        ref={(el) => { textRef.current = el; }}
        className={cls(
          "m-0 max-h-80 min-h-[1.6em] overflow-auto whitespace-pre-wrap break-all font-mono text-[clamp(17px,2vw,22px)] leading-relaxed transition-colors duration-700",
          formed ? "text-ink" : "text-transparent"
        )}
      >
        {masked ? "•".repeat(Math.min(value.length, 64)) : value}
      </p>
      <div className={cls("flex flex-wrap items-center gap-2.5 transition-opacity duration-500", formed ? "opacity-100" : "opacity-0")}>
        <CopyButton value={value} label={t("copySecret")} big className="min-h-12 px-6" />
        <Button variant="ghost" onClick={() => setMasked(!masked)} className="min-h-12">
          {masked ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          {masked ? tr("unmask") : tr("mask")}
        </Button>
      </div>
    </>
  );
}

function FileReveal({
  payload,
  formed,
  textRef,
  progress,
  onDownload,
}: {
  payload: SecretPayload;
  formed: boolean;
  textRef: React.RefObject<HTMLElement | null>;
  progress: number | null;
  onDownload: () => void;
}) {
  const t = useTranslations("viewer");
  const locale = useLocale() as Locale;
  return (
    <>
      <p ref={(el) => { textRef.current = el; }} className={cls("m-0 break-all font-mono text-lg transition-colors duration-700", formed ? "text-ink" : "text-transparent")}>
        {payload.name}
      </p>
      {payload.size ? <p className="-mt-2 font-mono text-xs text-ink-faint">{formatBytes(payload.size, locale)}</p> : null}
      {progress !== null && progress < 100 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      <div className={cls("transition-opacity duration-500", formed ? "opacity-100" : "opacity-0")}>
        <Button onClick={onDownload} className="min-h-12 px-6" disabled={progress !== null && progress < 100}>
          <Download className="size-4" />
          {progress === 100 ? t("downloaded") : progress !== null ? t("decryptingPct", { pct: progress }) : t("download")}
        </Button>
      </div>
    </>
  );
}

/**
 * Only http(s) may ever reach `location.href`. The URL comes from a payload the
 * SENDER controls end-to-end, so a crafted push could carry `javascript:` —
 * assigning that to `location.href` executes it in our own origin (XSS, and the
 * recipient's session is same-origin from there). The production CSP already
 * blocks `javascript:` (script-src has no 'unsafe-inline'), but CSP must not be
 * the only barrier: dev loosens it, and a future CSP edit would silently
 * re-open the hole. `data:`/`blob:` are refused for the same reason.
 */
function isNavigable(raw: string): boolean {
  try {
    const scheme = new URL(raw, window.location.href).protocol;
    return scheme === "http:" || scheme === "https:";
  } catch {
    return false;
  }
}

function UrlReveal({
  url,
  autoOpen,
  formed,
  textRef,
}: {
  url: string;
  autoOpen: boolean;
  formed: boolean;
  textRef: React.RefObject<HTMLElement | null>;
}) {
  const t = useTranslations("viewer");

  const navigable = typeof window !== "undefined" && isNavigable(url);

  // Same origin (ppush itself, e.g. /reset-password) → safe → auto-redirect
  // always. EXTERNAL URL → auto only if the recipient opted in (account).
  const sameOrigin =
    typeof window !== "undefined" &&
    (() => {
      try {
        return new URL(url, window.location.href).origin === window.location.origin;
      } catch {
        return false;
      }
    })();
  const auto = navigable && formed && (sameOrigin || autoOpen);

  const [count, setCount] = useState(5);
  useEffect(() => {
    if (!auto) return; // no auto-redirect by default (anti-phishing)
    if (count <= 0) {
      window.location.href = url;
      return;
    }
    const timer = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [auto, count, url]);

  return (
    <>
      <p ref={(el) => { textRef.current = el; }} className={cls("m-0 break-all font-mono text-[17px] transition-colors duration-700", formed ? "text-ink" : "text-transparent")}>
        {url}
      </p>
      {auto ? (
        <p className="text-sm text-ink-faint">{t("redirect", { s: count })}</p>
      ) : (
        <p className="inline-flex items-center gap-1.5 text-sm text-warn">
          <AlertTriangle className="size-3.5" /> {t("urlCheckBeforeOpen")}
        </p>
      )}
      <div className={cls("flex flex-wrap gap-2.5 transition-opacity duration-500", formed ? "opacity-100" : "opacity-0")}>
        {navigable && (
          <Button onClick={() => (window.location.href = url)} className="min-h-12 px-6">
            <ExternalLink className="size-4" />
            {t("openNow")}
          </Button>
        )}
        <CopyButton value={url} label={t("copyUrl")} />
      </div>
    </>
  );
}
