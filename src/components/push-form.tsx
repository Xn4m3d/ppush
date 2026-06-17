"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { useLocale, useTranslations } from "next-intl";
import {
  KeyRound,
  FileText,
  FileUp,
  Link2,
  Eye,
  EyeOff,
  Dices,
  UploadCloud,
  ShieldCheck,
  Lock,
  Clock,
  Flame,
  ArrowLeft,
} from "lucide-react";
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
import { Button, Input, Textarea, Field, Card, Toggle, ErrorText, cls } from "./ui";
import { CopyButton } from "./copy-button";

type Kind = "PASSWORD" | "TEXT" | "FILE" | "URL";

// Paliers d'expiration (en minutes) : infra-journaliers fixes + jours jusqu'au
// tier ceiling. The gauge moves tier by tier (non-linear).
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
};

type Created = { url: string; kind: Kind; expireAfterMinutes: number; expireAfterViews: number };

export function PushForm({ defaults }: { defaults: Defaults }) {
  const t = useTranslations("form");
  const tTabs = useTranslations("tabs");
  const locale = useLocale() as Locale;
  const [kind, setKind] = useState<Kind>("PASSWORD");
  const [secret, setSecret] = useState("");
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

  const reset = useCallback(() => {
    setSecret("");
    setFile(null);
    setPassphrase("");
    setNote("");
    setCreated(null);
    setError("");
    setProgress(null);
  }, []);

  // The logo and the header "New" button emit `ppush:reset` to start over
  // from a blank form even when already on the home page (a same-route
  // Link doesn't remount the component → the "success" screen would stay).
  useEffect(() => {
    const onReset = () => reset();
    window.addEventListener("ppush:reset", onReset);
    return () => window.removeEventListener("ppush:reset", onReset);
  }, [reset]);

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

  if (created) {
    return (
      <SuccessScreen
        created={created}
        hasPassphrase={!!passphrase}
        onNew={reset}
        tier={defaults.tier}
        shareTemplate={defaults.shareTemplates[created.kind]}
      />
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 animate-fade-up">
      {/* Onglets */}
      <div className="grid grid-cols-4 gap-1.5 rounded-2xl border border-line bg-panel p-1.5">
        {TABS.map(({ kind: k, icon: Icon }) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k);
              setError("");
              // files have their own duration ceiling → re-clamp to a valid tier
              setMinutes((m) => {
                const md = k === "FILE" ? defaults.maxFileDays : defaults.maxDays;
                const p = expiryPresets(md);
                return p[nearestPresetIndex(p, Math.min(m, md * 1440))];
              });
            }}
            className={cls(
              "flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-xs font-medium transition-all sm:flex-row sm:justify-center sm:gap-2 sm:text-sm cursor-pointer",
              kind === k
                ? "bg-accent/15 text-accent-soft shadow-[inset_0_0_0_1px_var(--accent-glow)]"
                : "text-ink-faint hover:bg-panel-soft hover:text-ink-dim"
            )}
          >
            <Icon className="size-4" />
            {tTabs(k)}
          </button>
        ))}
      </div>

      <Card className="p-6 space-y-5">
        {/* Secret content */}
        {kind === "PASSWORD" && (
          <div className="space-y-3">
            <Field label={t("passwordLabel")}>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showSecret ? "text" : "password"}
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder="••••••••••••"
                    className="pr-10 font-mono"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink cursor-pointer"
                    title={showSecret ? t("hide") : t("show")}
                  >
                    {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="subtle"
                  onClick={() => {
                    setSecret(generatePassword(genLength, genOpts));
                    setShowSecret(true);
                  }}
                  title={t("generateTitle")}
                >
                  <Dices className="size-4" />
                  <span className="hidden sm:inline">{t("generate")}</span>
                </Button>
              </div>
            </Field>
            <GeneratorOptions
              length={genLength}
              onLength={setGenLength}
              opts={genOpts}
              onOpts={setGenOpts}
            />
          </div>
        )}

        {kind === "TEXT" && (
          <Field label={t("textLabel")}>
            <Textarea
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              rows={6}
              placeholder={t("textPlaceholder")}
            />
          </Field>
        )}

        {kind === "URL" && (
          <Field label={t("urlLabel")} hint={t("urlHint")}>
            <Input
              type="url"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={t("urlPlaceholder")}
            />
          </Field>
        )}

        {kind === "FILE" && (
          <FileDrop file={file} onFile={setFile} maxMb={defaults.maxFileSizeMb} />
        )}

        {/* Expiration */}
        <div className="grid gap-4 sm:grid-cols-2">
          <ExpiryField
            icon={<Clock className="size-4" />}
            label={t("expiresAfter")}
            minutes={minutes}
            presets={expiryPresets(kind === "FILE" ? defaults.maxFileDays : defaults.maxDays)}
            onChange={setMinutes}
            locale={locale}
          />
          <RangeField
            icon={<Flame className="size-4" />}
            label={t("maxViews")}
            value={views}
            min={1}
            max={Math.min(defaults.maxViews, 100)}
            onChange={setViews}
            unit={t("viewUnit", { count: views })}
          />
        </div>

        {/* Advanced options */}
        <details className="group rounded-xl border border-line bg-bg-soft/50">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-ink-dim transition-colors hover:text-ink">
            {t("advanced")}
          </summary>
          <div className="space-y-3 border-t border-line px-3 pb-4 pt-3">
            <Field label={t("passphraseLabel")} hint={t("passphraseHint")}>
              <Input
                type="text"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder={t("passphrasePlaceholder")}
                autoComplete="off"
              />
            </Field>
            <Toggle
              checked={retrievalStep}
              onChange={setRetrievalStep}
              label={t("retrievalLabel")}
              hint={t("retrievalHint")}
            />
            <Toggle
              checked={deletable}
              onChange={setDeletable}
              label={t("deletableLabel")}
              hint={t("deletableHint")}
            />
            {defaults.showNote && (
              <Field label={t("noteLabel")} hint={t("noteHint")}>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("notePlaceholder")}
                  maxLength={500}
                />
              </Field>
            )}
          </div>
        </details>

        <ErrorText>{error}</ErrorText>

        <Button type="submit" loading={busy} className="w-full py-3 text-base">
          {progress ?? (
            <>
              <Lock className="size-4" />
              {t("submit")}
            </>
          )}
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-xs text-ink-faint">
          <ShieldCheck className="size-3.5 text-ok" />
          {t("footnote")}
        </p>
      </Card>
    </form>
  );
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
    <details className="group rounded-xl border border-line bg-bg-soft/50">
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

function RangeField({
  icon,
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-xl border border-line bg-bg-soft/50 p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink-dim">
          {icon}
          {label}
        </span>
        <span className="text-sm font-semibold text-accent-soft tabular-nums">
          {value} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="mt-3 w-full accent-[var(--color-accent)] cursor-pointer"
      />
    </div>
  );
}

/** Tiered expiry gauge (5 min → tier ceiling) — non-linear. */
function ExpiryField({
  icon,
  label,
  minutes,
  presets,
  onChange,
  locale,
}: {
  icon: React.ReactNode;
  label: string;
  minutes: number;
  presets: number[];
  onChange: (minutes: number) => void;
  locale: Locale;
}) {
  const idx = nearestPresetIndex(presets, minutes);
  return (
    <div className="rounded-xl border border-line bg-bg-soft/50 p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink-dim">
          {icon}
          {label}
        </span>
        <span className="text-sm font-semibold text-accent-soft tabular-nums">
          {formatDelay(presets[idx] * 60_000, locale)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={presets.length - 1}
        step={1}
        value={idx}
        onChange={(e) => onChange(presets[parseInt(e.target.value, 10)])}
        className="mt-3 w-full accent-[var(--color-accent)] cursor-pointer"
      />
    </div>
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
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
        drag
          ? "border-accent bg-accent/10"
          : "border-line hover:border-line-soft hover:bg-panel-soft/50"
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

function SuccessScreen({
  created,
  hasPassphrase,
  onNew,
  tier,
  shareTemplate,
}: {
  created: Created;
  hasPassphrase: boolean;
  onNew: () => void;
  tier: "anon" | "user";
  shareTemplate: string;
}) {
  const t = useTranslations("success");
  const locale = useLocale() as Locale;
  const [qr, setQr] = useState<string>("");

  const delay = formatDelay(created.expireAfterMinutes * 60_000, locale);
  // "Note to send with the link": ready-to-copy text the sender attaches to the
  // link THEMSELVES (never sent automatically). Templates [link]/[delay]/[views]
  // (square brackets, not braces: avoid next-intl's ICU parser).
  const recipientNotice = shareTemplate
    .replaceAll("[link]", created.url)
    .replaceAll("[delay]", delay)
    .replaceAll("[views]", String(created.expireAfterViews));

  useEffect(() => {
    QRCode.toDataURL(created.url, {
      width: 240,
      margin: 1,
      color: { dark: "#eef1f8", light: "#141823" },
    }).then(setQr);
  }, [created.url]);

  return (
    <Card className="p-8 text-center animate-fade-up">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-ok/10 border border-ok/25">
        <ShieldCheck className="size-7 text-ok" />
      </div>
      <h2 className="mt-4 text-xl font-semibold tracking-tight">{t("title")}</h2>
      <p className="mt-1 text-sm text-ink-faint">
        {t("expiry", { delay, views: created.expireAfterViews })}
        {hasPassphrase && t("withPassphrase")}.
      </p>

      <div className="mt-6 break-all rounded-xl border border-line bg-bg-soft px-4 py-3 font-mono text-sm text-accent-soft">
        {created.url}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <CopyButton value={created.url} label={t("copyLink")} big />
        <Button variant="ghost" onClick={onNew}>
          <ArrowLeft className="size-4" />
          {t("newPush")}
        </Button>
      </div>

      {/* Ready-to-copy details for the recipient */}
      <div className="mt-5 text-left">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="recipient-notice" className="text-xs font-medium text-ink-dim">
            {t("recipientLabel")}
          </label>
          <CopyButton value={recipientNotice} label={t("copyNotice")} />
        </div>
        <Textarea
          id="recipient-notice"
          readOnly
          rows={4}
          value={recipientNotice}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-2 resize-none text-xs leading-relaxed"
        />
        <p className="mt-1 text-xs text-ink-faint">{t("recipientHint")}</p>
      </div>

      {qr && (
        <div className="mt-6 flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={t("qrAlt")} className="rounded-xl border border-line" />
          <p className="text-xs text-ink-faint">{t("qrHint")}</p>
        </div>
      )}

      <p className="mt-6 text-xs text-ink-faint">{t("warning")}</p>

      {tier === "anon" && (
        <div className="mt-6 rounded-xl border border-accent/25 bg-accent/[0.07] px-4 py-3 text-left text-xs text-ink-dim">
          {t.rich("anonTip", {
            strong: (chunks) => <strong className="text-ink">{chunks}</strong>,
            link: (chunks) => (
              <Link
                href="/register"
                className="font-medium text-accent-soft underline-offset-2 hover:underline"
              >
                {chunks}
              </Link>
            ),
          })}
        </div>
      )}
    </Card>
  );
}
