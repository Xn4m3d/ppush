"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { useLocale, useTranslations } from "next-intl";
import { KeyRound, FileText, FileUp, Link2, Eye, EyeOff, Dices, UploadCloud, Lock, ArrowLeft } from "lucide-react";
import {
  generateKey,
  encryptPayload,
  encryptFile,
  generatePassword,
  passwordAlphabetSize,
  type PasswordOptions,
} from "@/lib/crypto";
import { formatBytes, formatDelay } from "@/lib/format";
import type { Locale } from "@/i18n/locale";
import { Button, Input, Textarea, Toggle, ErrorText, cls } from "./ui";
import { CopyButton } from "./copy-button";
import { DiffusionScene } from "./diffusion/scene";
import { AgeTimeline, DurationDial, ReadsPips, useWheel } from "./diffusion/controls";

type Kind = "PASSWORD" | "TEXT" | "FILE" | "URL";

// Expiry steps (in minutes): fixed sub-day steps + days up to the
// tier's cap. The ruler moves from step to step (non-linear).
const SUBDAY_PRESETS = [5, 15, 30, 60, 120, 360, 720]; // 5m 15m 30m 1h 2h 6h 12h
const DAY_STEPS = [1, 2, 3, 5, 7, 14, 21, 30, 60, 90];

function expiryPresets(maxDays: number): number[] {
  const days = DAY_STEPS.filter((d) => d <= maxDays);
  if (!days.includes(maxDays)) days.push(maxDays); // always able to reach the ceiling
  days.sort((a, b) => a - b);
  return [...SUBDAY_PRESETS, ...days.map((d) => d * 1440)];
}

function nearestPresetIndex(presets: number[], minutes: number): number {
  let best = 0;
  for (let i = 1; i < presets.length; i++) {
    if (Math.abs(presets[i] - minutes) < Math.abs(presets[best] - minutes)) best = i;
  }
  return best;
}

const TABS: { kind: Kind; icon: typeof KeyRound }[] = [
  { kind: "PASSWORD", icon: KeyRound },
  { kind: "TEXT", icon: FileText },
  { kind: "FILE", icon: FileUp },
  { kind: "URL", icon: Link2 },
];

type Defaults = {
  tier: "anon" | "user";
  days: number;
  views: number;
  retrievalStep: boolean;
  deletableByViewer: boolean;
  maxDays: number;
  maxFileDays: number;
  maxViews: number;
  maxFileSizeMb: number;
  showNote: boolean;
  // "Note to send with the link" template per push type (custom or default).
  shareTemplates: Record<Kind, string>;
  /** Account limits, shown greyed out to visitors without an account. */
  upgrade?: { maxDays: number; maxFileDays: number; maxViews: number };
};

type Created = { url: string; kind: Kind; expireAfterMinutes: number; expireAfterViews: number };

// Beyond that, only the start of the file is visualized: the cloud stops changing
// shape, and the preview encryption stays instant.
const PREVIEW_FILE_BYTES = 256 * 1024;
const WIDE = "(min-width: 1024px)";

export function PushForm({ defaults }: { defaults: Defaults }) {
  const t = useTranslations("form");
  const td = useTranslations("diffusion");
  const tTabs = useTranslations("tabs");
  const locale = useLocale() as Locale;
  const [kind, setKind] = useState<Kind>("PASSWORD");
  // one value per type: switching from "Password" to "URL" does not copy
  // the password into the URL field, and switching back finds it intact
  const [texts, setTexts] = useState<Record<Exclude<Kind, "FILE">, string>>({ PASSWORD: "", TEXT: "", URL: "" });
  const secret = kind === "FILE" ? "" : texts[kind];
  const setSecret = (v: string) => {
    if (kind !== "FILE") setTexts((m) => ({ ...m, [kind]: v }));
  };
  const [showSecret, setShowSecret] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [minutes, setMinutes] = useState(() => {
    const p = expiryPresets(defaults.maxDays);
    return p[nearestPresetIndex(p, defaults.days * 1440)];
  });
  const [views, setViews] = useState(defaults.views);
  const [passphrase, setPassphrase] = useState("");
  const [retrievalStep, setRetrievalStep] = useState(defaults.retrievalStep);
  const [deletable, setDeletable] = useState(defaults.deletableByViewer);
  const [note, setNote] = useState("");
  const [genLength, setGenLength] = useState(20);
  const [genOpts, setGenOpts] = useState<Required<PasswordOptions>>({
    lowercase: true,
    uppercase: true,
    digits: true,
    symbols: true,
    ambiguous: false,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [formed, setFormed] = useState(false);
  const [lock, setLock] = useState<"dur" | "views" | null>(null);
  const [cipherLen, setCipherLen] = useState(0);
  const [age, setAge] = useState(0);
  const [touch, setTouch] = useState(false);

  // ---- visualisation ----
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cloudRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const idRef = useRef<HTMLSpanElement>(null);
  const keyRef = useRef<HTMLSpanElement>(null);
  const zoneRef = useRef<HTMLElement>(null);
  const scene = useRef<DiffusionScene | null>(null);
  const previewKey = useRef<Promise<CryptoKey | null> | null>(null);
  const seq = useRef(0);
  const ageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const anchor = useCallback(
    () => (kind === "FILE" ? dropRef.current : fieldRef.current),
    [kind]
  );
  const anchorRef = useRef(anchor);
  useEffect(() => { anchorRef.current = anchor; });

  useEffect(() => {
    const host = hostRef.current, canvas = canvasRef.current;
    if (!host || !canvas) return;
    const sc = new DiffusionScene({
      direction: "out",
      host,
      canvas,
      cloud: () => cloudRef.current,
      anchor: () => anchorRef.current(),
      stackAnchor: () => formRef.current,
      stacked: () => !window.matchMedia(WIDE).matches,
    });
    scene.current = sc;
    const mq = window.matchMedia("(hover: none)");
    const onTouch = () => setTouch(mq.matches);
    mq.addEventListener("change", onTouch);
    const raf = requestAnimationFrame(onTouch);
    return () => { cancelAnimationFrame(raf); mq.removeEventListener("change", onTouch); sc.destroy(); scene.current = null; };
  }, []);

  /** THROWAWAY ciphertext for the preview: different key and IV from the real send. */
  const preview = useCallback(async (data: Uint8Array, emit: "caret" | "all") => {
    const my = ++seq.current;
    const sc = scene.current;
    if (!sc) return;
    let out: Uint8Array;
    if (!data.length) out = new Uint8Array(0);
    else if (window.crypto?.subtle) {
      if (!previewKey.current) {
        previewKey.current = crypto.subtle
          .importKey("raw", crypto.getRandomValues(new Uint8Array(32)), "AES-GCM", false, ["encrypt"])
          .catch(() => null);
      }
      const key = await previewKey.current;
      const iv = crypto.getRandomValues(new Uint8Array(12));
      out = key
        ? new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data as BufferSource))
        : crypto.getRandomValues(new Uint8Array(data.length + 16));
    } else out = crypto.getRandomValues(new Uint8Array(data.length + 16));
    if (my !== seq.current || !scene.current) return;
    sc.layout();
    const el = fieldRef.current;
    let span = null;
    if (el && (kind === "PASSWORD" || kind === "URL" || kind === "TEXT")) {
      span = sc.textSpan(el, kind === "PASSWORD" && !showSecret, emit === "caret");
    } else if (dropRef.current) {
      const r = sc.toHost(dropRef.current.getBoundingClientRect());
      span = { x0: r.x + 20, x1: r.x + r.w - 20, y0: r.y + 20, y1: r.y + r.h - 20 };
    }
    sc.setBytes(out, span);
    setCipherLen(out.length);
    if (emit === "caret" && el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("pulse-field");
      setTimeout(() => el.classList.remove("pulse-field"), 260);
    }
  }, [kind, showSecret]);

  const changeSecret = (v: string) => {
    setSecret(v);
    void preview(new TextEncoder().encode(v), "caret");
  };

  const changeFile = async (f: File | null) => {
    setFile(f);
    scene.current?.clear();
    if (!f) { setCipherLen(0); return; }
    const head = new Uint8Array(await f.slice(0, PREVIEW_FILE_BYTES).arrayBuffer());
    void preview(head, "all");
  };

  const reset = useCallback(() => {
    setTexts({ PASSWORD: "", TEXT: "", URL: "" });
    setFile(null);
    setPassphrase("");
    setNote("");
    setCreated(null);
    setFormed(false);
    setError("");
    setProgress(null);
    setCipherLen(0);
    setAge(0);
    previewKey.current = null;
    scene.current?.unseal();
  }, []);

  // The logo and the header "New" button emit `ppush:reset` to start over
  // from a blank form even when already on the home page (a same-route
  // Link doesn't remount the component → the "success" screen would stay).
  useEffect(() => {
    const onReset = () => reset();
    window.addEventListener("ppush:reset", onReset);
    return () => window.removeEventListener("ppush:reset", onReset);
  }, [reset]);

  // settings mirrored in the visualization
  useEffect(() => {
    const sc = scene.current;
    if (!sc) return;
    sc.reads = views;
    sc.ring = passphrase.length > 0;
    sc.ageTarget = age;
    sc.destroyedLabel = td("destroyed");
  }, [views, passphrase, age, td]);

  // created: the cloud writes the address, the key comes from the field
  useEffect(() => {
    if (!created) return;
    const sc = scene.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const raf = requestAnimationFrame(() => {
      if (!sc || !idRef.current || !keyRef.current) return;
      sc.layout();
      const el = fieldRef.current;
      const from = el && kind !== "FILE"
        ? sc.textSpan(el, kind === "PASSWORD" && !showSecret)
        : dropRef.current
          ? (() => { const r = sc.toHost(dropRef.current!.getBoundingClientRect()); return { x0: r.x + 20, x1: r.x + r.w - 20, y0: r.y + 20, y1: r.y + r.h - 20 }; })()
          : null;
      sc.seal(idRef.current, keyRef.current, from);
      if (!window.matchMedia(WIDE).matches) zoneRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      timer = setTimeout(() => { sc.settle(); setFormed(true); }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1700);
    });
    return () => { cancelAnimationFrame(raf); if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [created]);

  // aging: wheel over the cloud; once released, back to the present
  const setAgeHold = (v: number, hold: boolean) => {
    setAge(Math.max(0, Math.min(1, v)));
    if (ageTimer.current) clearTimeout(ageTimer.current);
    if (!hold) ageTimer.current = setTimeout(() => setAge(0), 2200);
  };
  useWheel(zoneRef, (e) => {
    if (!cipherLen || created) return;
    if ((e.target as HTMLElement).closest("[data-noage]")) return;
    e.preventDefault();
    setAgeHold(age + e.deltaY * (e.deltaMode === 1 ? 16 : 1) * 0.0011, false);
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (kind === "FILE" && !file) return setError(t("errorEmptyFile"));
    if (kind !== "FILE" && !secret.trim()) return setError(t("errorEmptyContent"));
    if (kind === "URL") {
      try {
        const u = new URL(secret.trim());
        if (!["http:", "https:"].includes(u.protocol)) throw new Error();
      } catch {
        return setError(t("errorInvalidUrl"));
      }
    }
    if (kind === "FILE" && file && file.size > defaults.maxFileSizeMb * 1024 * 1024) {
      return setError(t("errorFileTooBig", { mb: defaults.maxFileSizeMb }));
    }

    setBusy(true);
    try {
      // 1. ephemeral key generated locally — never leaves this browser
      const { key, keyB64 } = await generateKey();

      let blobPath: string | undefined;
      let payloadBytes: Uint8Array;

      if (kind === "FILE" && file) {
        setProgress(t("progressEncrypting"));
        const encrypted = await encryptFile(key, file, (done, total) =>
          setProgress(t("progressEncryptingPct", { pct: Math.round((done / total) * 100) }))
        );
        setProgress(t("progressUploading"));
        const up = await fetch("/api/blobs", { method: "POST", body: encrypted });
        const upData = await up.json();
        if (!up.ok) throw new Error(upData.error ?? t("errorUpload"));
        blobPath = upData.blobPath;
        payloadBytes = await encryptPayload(key, {
          t: "FILE",
          d: "",
          name: file.name,
          mime: file.type,
          size: file.size,
        });
      } else {
        payloadBytes = await encryptPayload(key, { t: kind, d: secret });
      }

      setProgress(t("progressCreating"));
      const res = await fetch("/api/pushes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          ciphertext: btoa(String.fromCharCode(...payloadBytes)),
          blobPath,
          passphrase: passphrase || undefined,
          expireAfterMinutes: minutes,
          expireAfterViews: views,
          retrievalStep,
          deletableByViewer: deletable,
          note: note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("errorCreate"));

      setAge(0);
      setFormed(false);
      setCreated({
        url: `${data.url}#${keyB64}`,
        kind,
        expireAfterMinutes: minutes,
        expireAfterViews: views,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg === "INSECURE_CONTEXT" ? t("errorInsecureContext") : msg || t("errorGeneric"));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  // ---- lifetime & views ----
  const maxDaysNow = kind === "FILE" ? defaults.maxFileDays : defaults.maxDays;
  const upDays = defaults.upgrade ? (kind === "FILE" ? defaults.upgrade.maxFileDays : defaults.upgrade.maxDays) : maxDaysNow;
  const allowedPresets = expiryPresets(maxDaysNow);
  const dialPresets = Array.from(new Set([...allowedPresets, ...expiryPresets(Math.max(upDays, maxDaysNow))])).sort((a, b) => a - b);
  const allowedMaxIdx = dialPresets.indexOf(maxDaysNow * 1440);
  const durIdx = nearestPresetIndex(dialPresets, minutes);
  const upViews = defaults.upgrade?.maxViews ?? defaults.maxViews;

  const unit = (min: number, short: boolean) => {
    if (min < 60) return td(short ? "sMin" : "dMin", { n: min });
    if (min < 1440 || min % 1440 !== 0) return td(short ? "sHour" : "dHour", { n: Math.round(min / 60) });
    return td(short ? "sDay" : "dDay", { n: min / 1440 });
  };
  const longDelay = unit(minutes, false);

  const limitNote =
    lock === "dur"
      ? td("limitDur", { delay: unit(maxDaysNow * 1440, false), max: unit(upDays * 1440, false) })
      : lock === "views"
        ? td("limitViews", { views: defaults.maxViews, max: upViews })
        : defaults.tier === "anon"
          ? td.rich("limitsAnon", {
              delay: unit(maxDaysNow * 1440, false),
              views: defaults.maxViews,
              link: (c) => <Link href="/register" className="text-ink-dim underline underline-offset-2 hover:text-ink">{c}</Link>,
            })
          : td("limitsUser");

  const ageDelay = formatDelay(age * minutes * 60_000, locale);
  const ageBubble = age < 0.005 ? td("ageNow") : age > 0.995 ? td("ageExpired") : td("ageIn", { delay: ageDelay });
  const narrowTicks = [0, 0.5, 1];
  const ticks = (touch ? narrowTicks : [0, 0.25, 0.5, 0.75, 1]).map((at) => ({
    at,
    label: at === 0 ? td("ageNow") : formatDelay(at * minutes * 60_000, locale),
  }));

  const sealed = !!created;

  return (
    <div ref={hostRef} className="relative mx-auto w-full max-w-6xl flex-1 px-4 pb-10 pt-6 sm:px-6">
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 z-[3] h-full w-full" />
      <div className="grid gap-x-16 gap-y-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.1fr)]">
        <form ref={formRef} onSubmit={submit} className="relative z-[2] flex min-w-0 flex-col gap-3.5 animate-fade-up">
          <h1 className="text-[clamp(28px,3.3vw,42px)] font-bold leading-[1.04]">
            <HeroTitle />
          </h1>
          <p className="-mt-1 max-w-[46ch] text-base text-ink-dim">
            {td.rich("lede", { b: (c) => <b className="font-medium text-ink">{c}</b> })}
          </p>

          <fieldset disabled={sealed} className={cls("flex min-w-0 flex-col gap-3.5 transition-opacity", sealed && "opacity-55")}>
            {/* Content type */}
            <div className="grid grid-cols-4 gap-1.5" role="group" aria-label={t("passwordLabel")}>
              {TABS.map(({ kind: k, icon: Icon }) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => {
                    if (k === kind) return;
                    setKind(k);
                    setError("");
                    scene.current?.clear();
                    setCipherLen(0);
                    // files have their own duration ceiling → re-clamp to a valid tier
                    setMinutes((m) => {
                      const md = k === "FILE" ? defaults.maxFileDays : defaults.maxDays;
                      const p = expiryPresets(md);
                      return p[nearestPresetIndex(p, Math.min(m, md * 1440))];
                    });
                    // content of the new type: re-encrypt it for the cloud
                    const v = k === "FILE" ? null : texts[k];
                    if (k === "FILE") { if (file) void changeFile(file); }
                    else if (v) setTimeout(() => void preview(new TextEncoder().encode(v), "all"), 0);
                  }}
                  className={cls(
                    "flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border px-2 py-2.5 text-[13px] font-medium transition-colors sm:text-sm cursor-pointer",
                    kind === k ? "border-ink bg-ink text-bg" : "border-line bg-bg text-ink hover:border-line-soft"
                  )}
                >
                  <Icon className="hidden size-4 sm:block" />
                  {tTabs(k)}
                </button>
              ))}
            </div>

            {/* Secret content */}
            {kind === "PASSWORD" && (
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor="pp-secret" className="eyebrow">{t("passwordLabel")}</label>
                  <span className="flex gap-1">
                    <button type="button" onClick={() => setShowSecret(!showSecret)} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-ink-dim hover:bg-panel hover:text-ink cursor-pointer">
                      {showSecret ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      {showSecret ? t("hide") : t("show")}
                    </button>
                    <button
                      type="button"
                      title={t("generateTitle")}
                      onClick={() => {
                        const v = generatePassword(genLength, genOpts);
                        setSecret(v);
                        setShowSecret(true);
                        scene.current?.clear();
                        void preview(new TextEncoder().encode(v), "all");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-ink-dim hover:bg-panel hover:text-ink cursor-pointer"
                    >
                      <Dices className="size-3.5" />
                      {t("generate")}
                    </button>
                  </span>
                </div>
                {/* No `type="password"`: password managers would treat this as
                    a login field and inject a stored credential (they ignore
                    `autocomplete=off` on password fields). We mask the value
                    with CSS instead and opt out of the remaining heuristics
                    via per-manager data attributes. */}
                <Input
                  id="pp-secret"
                  ref={(el: HTMLInputElement | HTMLTextAreaElement | null) => { fieldRef.current = el; }}
                  type="text"
                  value={secret}
                  onChange={(e) => changeSecret(e.target.value)}
                  placeholder="••••••••••••"
                  className={cls("min-h-14 font-mono text-[17px] sm:text-[17px]", !showSecret && "[-webkit-text-security:disc]")}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-1p-ignore
                  data-lpignore="true"
                  data-bwignore
                  data-form-type="other"
                />
                <GeneratorOptions length={genLength} onLength={setGenLength} opts={genOpts} onOpts={setGenOpts} />
              </div>
            )}

            {kind === "TEXT" && (
              <div className="flex flex-col gap-2">
                <label htmlFor="pp-text" className="eyebrow">{t("textLabel")}</label>
                <Textarea
                  id="pp-text"
                  ref={(el: HTMLInputElement | HTMLTextAreaElement | null) => { fieldRef.current = el; }}
                  value={secret}
                  onChange={(e) => changeSecret(e.target.value)}
                  rows={4}
                  placeholder={t("textPlaceholder")}
                  className="font-mono"
                />
              </div>
            )}

            {kind === "URL" && (
              <div className="flex flex-col gap-2">
                <label htmlFor="pp-url" className="eyebrow">{t("urlLabel")}</label>
                <Input
                  id="pp-url"
                  ref={(el: HTMLInputElement | HTMLTextAreaElement | null) => { fieldRef.current = el; }}
                  type="url"
                  value={secret}
                  onChange={(e) => changeSecret(e.target.value)}
                  placeholder={t("urlPlaceholder")}
                  className="min-h-14 font-mono"
                />
                <span className="text-xs text-ink-faint">{t("urlHint")}</span>
              </div>
            )}

            {kind === "FILE" && (
              <div ref={dropRef}>
                <FileDrop file={file} onFile={(f) => void changeFile(f)} maxMb={defaults.maxFileSizeMb} />
              </div>
            )}

            {/* Lifetime and views: two ways to expire, whichever comes first wins */}
            <div className="grid gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span id="pp-dur" className="eyebrow">{td("validFor")}</span>
                  <output className="text-lg font-bold tracking-tight tabular-nums">{longDelay}</output>
                </div>
                <DurationDial
                  presets={dialPresets}
                  allowedMax={allowedMaxIdx}
                  index={durIdx}
                  onChange={(i) => setMinutes(dialPresets[i])}
                  onLocked={(l) => setLock(l ? "dur" : null)}
                  short={(m) => unit(m, true)}
                  labelId="pp-dur"
                  valueText={longDelay}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span id="pp-reads" className="eyebrow">{td("reads")}</span>
                  <output className="text-lg font-bold tracking-tight tabular-nums">{td("readsValue", { count: views })}</output>
                </div>
                <ReadsPips
                  value={views}
                  allowed={Math.min(defaults.maxViews, 100)}
                  onChange={setViews}
                  onLocked={(l) => setLock(l ? "views" : null)}
                  labelId="pp-reads"
                  valueText={td("readsValue", { count: views })}
                  moreLabel={td("readsMore")}
                  lessLabel={td("readsLess")}
                />
              </div>
              <p className={cls("text-[13px] sm:col-span-2", lock ? "text-accent" : "text-ink-faint")} aria-live="polite">
                {limitNote}
              </p>
            </div>

            {/* Advanced options */}
            <details className="group rounded-xl border border-line bg-bg/60">
              <summary className="cursor-pointer select-none px-4 py-2.5 text-sm text-ink-dim transition-colors hover:text-ink">
                {t("advanced")}
              </summary>
              <div className="space-y-3 border-t border-line px-3 pb-4 pt-3">
                <label className="block space-y-1.5 px-1">
                  <span className="eyebrow">{t("passphraseLabel")}</span>
                  <Input
                    type="text"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder={t("passphrasePlaceholder")}
                    autoComplete="off"
                  />
                  <span className="block text-xs text-ink-faint">{t("passphraseHint")}</span>
                </label>
                <Toggle checked={retrievalStep} onChange={setRetrievalStep} label={t("retrievalLabel")} hint={t("retrievalHint")} />
                <Toggle checked={deletable} onChange={setDeletable} label={t("deletableLabel")} hint={t("deletableHint")} />
                {defaults.showNote && (
                  <label className="block space-y-1.5 px-1">
                    <span className="eyebrow">{t("noteLabel")}</span>
                    <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("notePlaceholder")} maxLength={500} />
                    <span className="block text-xs text-ink-faint">{t("noteHint")}</span>
                  </label>
                )}
              </div>
            </details>

            <ErrorText>{error}</ErrorText>
          </fieldset>

          {!sealed && (
            <Button type="submit" loading={busy} className="min-h-14 w-full text-base">
              {progress ?? (
                <>
                  <Lock className="size-4" />
                  {t("submit")}
                </>
              )}
            </Button>
          )}

          {defaults.tier === "anon" && !sealed && (
            <p className="text-[13px] text-ink-faint">
              {td.rich("anonStrip", {
                link: (c) => <Link href="/register" className="font-medium text-ink-dim underline underline-offset-2 hover:text-ink">{c}</Link>,
              })}
            </p>
          )}
        </form>

        {/* The cloud: what the server receives — then, once created, the link */}
        <section ref={zoneRef} aria-label={sealed ? td("zoneLink") : td("zoneSend")} className={cls("relative z-[4] flex min-w-0 flex-col", sealed ? "" : "min-h-[380px] lg:min-h-[460px]")}>
          <div className="flex justify-between gap-3 eyebrow">
            <span>{sealed ? td("zoneLink") : age > 0.995 ? td("zoneGone") : td("zoneSend")}</span>
            <span className="text-accent">{td("algo")}</span>
          </div>
          {!sealed ? (
            <>
              <div
                ref={cloudRef}
                role="img"
                aria-label={cipherLen ? td("cloudAria", { bytes: cipherLen }) : td("cloudEmpty")}
                className={cls("min-h-[240px] flex-1", cipherLen > 0 && "cursor-ns-resize")}
              />
              <div data-noage>
              <AgeTimeline value={age} onChange={setAgeHold} ticks={ticks} bubble={ageBubble} label={td("ageLabel")} />
              <div className="mt-1 flex flex-wrap justify-between gap-x-4 gap-y-1 font-mono text-xs text-ink-faint tabular-nums" aria-live="polite">
                <span>{cipherLen ? td.rich("metaBytes", { bytes: cipherLen, b: (c) => <b className="font-medium text-ink">{c}</b> }) : td("metaEmpty")}</span>
                <span>{touch ? td("hintTouch") : td("hintWheel")}</span>
              </div>
              </div>
            </>
          ) : (
            <ShareCard
              created={created!}
              formed={formed}
              hasPassphrase={!!passphrase}
              onNew={reset}
              tier={defaults.tier}
              shareTemplate={defaults.shareTemplates[created!.kind]}
              idRef={idRef}
              keyRef={keyRef}
              delayLabel={unit(created!.expireAfterMinutes, false)}
            />
          )}
        </section>
      </div>
    </div>
  );
}

/** Home title, with the highlighted word in the accent color. */
function HeroTitle() {
  const t = useTranslations("home");
  return <>{t.rich("title", { em: (c) => <em className="not-italic text-accent">{c}</em> })}</>;
}

function GeneratorOptions({
  length,
  onLength,
  opts,
  onOpts,
}: {
  length: number;
  onLength: (n: number) => void;
  opts: Required<PasswordOptions>;
  onOpts: (o: Required<PasswordOptions>) => void;
}) {
  const t = useTranslations("generator");
  const entropy = Math.round(length * Math.log2(passwordAlphabetSize(opts)));
  const classKeys = ["lowercase", "uppercase", "digits", "symbols"] as const;
  const enabledCount = classKeys.filter((k) => opts[k]).length;

  function setClass(key: (typeof classKeys)[number], v: boolean) {
    // always keep at least one character class enabled
    if (!v && enabledCount === 1 && opts[key]) return;
    onOpts({ ...opts, [key]: v });
  }

  return (
    <details className="group rounded-xl border border-line bg-bg/60">
      <summary className="flex cursor-pointer select-none items-center justify-between px-4 py-2.5 text-sm text-ink-dim transition-colors hover:text-ink">
        <span>{t("summary")}</span>
        <span className="text-xs text-ink-faint tabular-nums">
          {t("summaryStats", { length, bits: entropy })}
        </span>
      </summary>
      <div className="space-y-1 border-t border-line px-2 pb-3 pt-3">
        <div className="px-2 pb-2">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-medium text-ink-dim">{t("length")}</span>
            <span className="font-semibold text-accent-soft tabular-nums">
              {t("lengthValue", { count: length })}
            </span>
          </div>
          <input
            type="range"
            min={8}
            max={64}
            value={length}
            onChange={(e) => onLength(parseInt(e.target.value, 10))}
            className="mt-2 w-full accent-[var(--color-accent)] cursor-pointer"
          />
        </div>
        <Toggle
          checked={opts.lowercase}
          onChange={(v) => setClass("lowercase", v)}
          label={t("lowercase")}
        />
        <Toggle
          checked={opts.uppercase}
          onChange={(v) => setClass("uppercase", v)}
          label={t("uppercase")}
        />
        <Toggle
          checked={opts.digits}
          onChange={(v) => setClass("digits", v)}
          label={t("digits")}
        />
        <Toggle
          checked={opts.symbols}
          onChange={(v) => setClass("symbols", v)}
          label={t("symbols")}
        />
        <Toggle
          checked={opts.ambiguous}
          onChange={(v) => onOpts({ ...opts, ambiguous: v })}
          label={t("ambiguous")}
          hint={t("ambiguousHint")}
        />
        <p className="px-2 pt-1 text-xs text-ink-faint">
          {t("guarantee", { bits: entropy })}
        </p>
      </div>
    </details>
  );
}

function FileDrop({
  file,
  onFile,
  maxMb,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  maxMb: number;
}) {
  const t = useTranslations("fileDrop");
  const locale = useLocale() as Locale;
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  // transparent fair-use: space actually available server-side
  // (+ personal quota of active files if signed in)
  const [storage, setStorage] = useState<{
    availableBytes: number;
    user?: { usedBytes: number; availableBytes: number; quotaBytes: number };
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/storage")
      .then(async (res) => {
        if (res.ok && !cancelled) setStorage(await res.json());
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const maxBytes = maxMb * 1024 * 1024;
  const avail = storage?.availableBytes ?? null;
  const userAvail = storage?.user?.availableBytes ?? null;
  const effectiveMax = Math.min(maxBytes, avail ?? Infinity, userAvail ?? Infinity);
  const quotaBinding = userAvail !== null && userAvail <= (avail ?? Infinity);
  const lowSpace = effectiveMax < maxBytes;
  const tooBig = file !== null && file.size > effectiveMax;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
      onClick={() => inputRef.current?.click()}
      className={cls(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-panel px-6 py-8 text-center transition-colors",
        drag
          ? "border-accent bg-accent/10"
          : "border-line-soft hover:border-ink-faint"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <UploadCloud className="size-8 text-ink-faint" />
      {file ? (
        <>
          <p className="text-sm font-medium text-ink break-all">{file.name}</p>
          <p className="text-xs text-ink-faint">
            {t("selected", { size: (file.size / 1024 / 1024).toFixed(2) })}
          </p>
          {tooBig && (
            <p className="text-xs text-warn">
              {t("tooBig", { max: formatBytes(effectiveMax, locale) })}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-ink-dim">{t("prompt")}</p>
          <p className="text-xs text-ink-faint">
            {t("limit", { mb: maxMb })}
            {avail !== null &&
              !lowSpace &&
              t("freeSpace", { space: formatBytes(avail, locale) })}
          </p>
          {storage?.user && storage.user.usedBytes > 0 && (
            <p className="text-xs text-ink-faint">
              {t("personalSpace", {
                available: formatBytes(storage.user.availableBytes, locale),
                quota: formatBytes(storage.user.quotaBytes, locale),
              })}
            </p>
          )}
          {lowSpace && (
            <p className="text-xs text-warn">
              {quotaBinding
                ? t("quotaAlmostFull", { left: formatBytes(effectiveMax, locale) })
                : t("almostFull", { left: formatBytes(effectiveMax, locale) })}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The link, written by the particles: the address comes from the cloud (that is
 * what is stored), the key comes from the field (it never went through the
 * server). The real text stays transparent until the shape is complete.
 */
function ShareCard({
  created,
  formed,
  hasPassphrase,
  onNew,
  tier,
  shareTemplate,
  idRef,
  keyRef,
  delayLabel,
}: {
  created: Created;
  formed: boolean;
  hasPassphrase: boolean;
  onNew: () => void;
  tier: "anon" | "user";
  shareTemplate: string;
  idRef: React.RefObject<HTMLSpanElement | null>;
  keyRef: React.RefObject<HTMLSpanElement | null>;
  delayLabel: string;
}) {
  const t = useTranslations("success");
  const td = useTranslations("diffusion");
  const [qr, setQr] = useState<string>("");
  const hash = created.url.indexOf("#");
  const address = created.url.slice(0, hash);
  const keyPart = created.url.slice(hash);

  // delay spelled out in the message ("2 days" rather than "2 d")
  const delay = delayLabel;
  // "Note to send with the link": ready-to-copy text the sender attaches to the
  // link THEMSELVES (never sent automatically). Templates [link]/[delay]/[views]
  // (square brackets, not braces: avoid next-intl's ICU parser).
  const recipientNotice = shareTemplate
    .replaceAll("[link]", created.url)
    .replaceAll("[delay]", delay)
    .replaceAll("[views]", String(created.expireAfterViews));

  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    QRCode.toDataURL(created.url, {
      width: 220,
      margin: 1,
      color: {
        dark: cs.getPropertyValue("--fx-ink").trim() || "#e4e9f0",
        light: cs.getPropertyValue("--color-bg").trim() || "#07090d",
      },
    }).then(setQr);
  }, [created.url]);

  const sum = [td("shareViews", { views: created.expireAfterViews }), hasPassphrase ? td("sharePass") : null, td("shareNoKey")]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-4 pt-5">
      <p className="m-0 break-all font-mono text-[clamp(15px,1.5vw,18px)] leading-[1.75]">
        <span ref={idRef} className={cls("transition-colors duration-700", formed ? "text-ink" : "text-transparent")}>{address}</span>
        <span ref={keyRef} className={cls("transition-colors duration-700", formed ? "text-accent" : "text-transparent")}>{keyPart}</span>
      </p>
      <p className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-ink-faint">
        <span className="flex items-start gap-2"><i className="mt-[5px] inline-block size-2 flex-none rounded-full bg-ink" /><span>{td("legendAddress")}</span></span>
        <span className="flex items-start gap-2">
          <i className="mt-[5px] inline-block size-2 flex-none rounded-full bg-accent" />
          <span>{td("legendKey")} · <b className="font-medium text-ink">{td("legendExpires", { delay: delayLabel })}</b></span>
        </span>
      </p>

      <div className={cls("flex flex-col gap-4 transition-[opacity,transform] delay-150 duration-500", formed ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0")}>
        <div className="flex flex-wrap items-center gap-2.5">
          <CopyButton value={created.url} label={t("copyLink")} big className="min-h-12 px-6" />
          <Button variant="ghost" onClick={onNew} className="min-h-12">
            <ArrowLeft className="size-4" />
            {t("newPush")}
          </Button>
        </div>
        <p className="border-t border-line pt-3 font-mono text-xs text-ink-faint">{sum}</p>

        <details className="rounded-xl border border-line bg-bg/60">
          <summary className="cursor-pointer select-none px-4 py-2.5 text-sm text-ink-dim hover:text-ink">{td("recipientDetails")}</summary>
          <div className="space-y-2 border-t border-line px-4 pb-4 pt-3">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="recipient-notice" className="eyebrow">{t("recipientLabel")}</label>
              <CopyButton value={recipientNotice} label={t("copyNotice")} />
            </div>
            <Textarea
              id="recipient-notice"
              readOnly
              rows={4}
              value={recipientNotice}
              onFocus={(e) => e.currentTarget.select()}
              className="resize-none text-xs leading-relaxed"
            />
            <p className="text-xs text-ink-faint">{t("recipientHint")}</p>
          </div>
        </details>

        {qr && (
          <details className="rounded-xl border border-line bg-bg/60">
            <summary className="cursor-pointer select-none px-4 py-2.5 text-sm text-ink-dim hover:text-ink">{td("qrDetails")}</summary>
            <div className="flex flex-col items-center gap-2 border-t border-line px-4 pb-4 pt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt={t("qrAlt")} className="rounded-lg border border-line" />
              <p className="text-xs text-ink-faint">{t("qrHint")}</p>
            </div>
          </details>
        )}

        {tier === "anon" && (
          <p className="text-[13px] text-ink-faint">
            {t.rich("anonTip", {
              strong: (chunks) => <strong className="text-ink">{chunks}</strong>,
              link: (chunks) => (
                <Link href="/register" className="font-medium text-ink-dim underline underline-offset-2 hover:text-ink">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        )}
      </div>
    </div>
  );
}
