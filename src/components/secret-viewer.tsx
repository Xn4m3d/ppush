"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  ShieldCheck,
  ShieldOff,
  Eye,
  KeyRound,
  Download,
  Flame,
  ExternalLink,
  AlertTriangle,
  Lock,
  Clock,
  ShieldAlert,
} from "lucide-react";
import {
  importKey,
  decryptPayload,
  decryptFileStream,
  fromB64Url,
  type SecretPayload,
} from "@/lib/crypto";
import { Button, Input, Card, ErrorText, cls } from "./ui";
import { GuardianCat, PawLoader } from "./cat";
import { CopyButton } from "./copy-button";

type Meta = {
  slug: string;
  kind: string;
  expired: boolean;
  retrievalStep: boolean;
  deletableByViewer: boolean;
  hasPassphrase: boolean;
  fileSize: number | null;
  expiresAt: string;
};

type Stage =
  | "loading"
  | "expired"
  | "no-key"
  | "gate" // passphrase and/or retrieval step
  | "revealing"
  | "revealed"
  | "burned"
  | "error";

export function SecretViewer({ slug, autoOpen = false }: { slug: string; autoOpen?: boolean }) {
  const t = useTranslations("viewer");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [stage, setStage] = useState<Stage>("loading");
  const [keyB64, setKeyB64] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<SecretPayload | null>(null);
  const [viewToken, setViewToken] = useState<string | null>(null);
  const [deletable, setDeletable] = useState(false);
  const [dlProgress, setDlProgress] = useState<number | null>(null);

  // switch the screen to "expired" when the countdown reaches zero
  const expire = useCallback(() => setStage("expired"), []);

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
          if (res.status === 410) return setStage("expired");
          setError(data.error ?? t("serverError"));
          return setStage("gate");
        }
        const key = await importKey(k);
        const bytes = fromB64Url(
          data.ciphertext.replace(/\+/g, "-").replace(/\//g, "_")
        );
        const decrypted = await decryptPayload(key, bytes);
        setPayload(decrypted);
        setViewToken(data.viewToken ?? null);
        setDeletable(data.deletableByViewer);
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
      const res = await fetch(`/api/p/${slug}/blob?vt=${viewToken}`);
      if (!res.ok || !res.body) throw new Error("Download failed");
      const blob = await decryptFileStream(key, res.body, payload.mime ?? "", (b) =>
        setDlProgress(payload.size ? Math.min(100, Math.round((b / payload.size) * 100)) : 0)
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = payload.name ?? "fichier";
      a.click();
      URL.revokeObjectURL(url);
      setDlProgress(100);
    } catch {
      setError(t("downloadFailed"));
      setDlProgress(null);
    }
  }

  async function burn() {
    if (!confirm(t("burnConfirm"))) return;
    const res = await fetch(`/api/p/${slug}/burn`, { method: "POST" });
    if (res.ok) setStage("burned");
  }

  // ---- renders by state ----

  if (stage === "loading") {
    return (
      <Card className="p-10 text-center">
        <PawLoader />
      </Card>
    );
  }

  if (stage === "expired" || stage === "burned") {
    return (
      <div className="animate-fade-up">
        <Card className="p-10 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-danger/10 border border-danger/25">
            <ShieldOff className="size-7 text-danger" />
          </div>
          <h1 className="mt-4 text-xl font-semibold">
            {stage === "burned" ? t("burnedTitle") : t("expiredTitle")}
          </h1>
          <p className="mt-2 text-sm text-ink-faint">
            {stage === "burned" ? t("burnedBody") : t("expiredBody")}
          </p>
        </Card>

        {/* Invitation to try ppush / learn more */}
        <div className="mt-5 rounded-2xl border border-line bg-panel/40 p-5 text-center">
          <p className="text-sm font-medium text-ink">{t("expiredInviteTitle")}</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-ink-dim">{t("expiredInviteText")}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2.5">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white shadow-[0_4px_20px_-4px_var(--accent-glow)] transition-all hover:bg-accent-soft"
            >
              <Lock className="size-4" />
              {t("thanksCreate")}
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-sm text-ink-dim transition-colors hover:border-line-soft hover:text-ink"
            >
              {t("thanksAbout")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "no-key") {
    return (
      <Card className="p-10 text-center animate-fade-up">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-warn/10 border border-warn/25">
          <AlertTriangle className="size-7 text-warn" />
        </div>
        <h1 className="mt-4 text-xl font-semibold">{t("noKeyTitle")}</h1>
        <p className="mt-2 text-sm text-ink-faint">
          {t.rich("noKeyBody", { code: (chunks) => <code>{chunks}</code> })}
        </p>
      </Card>
    );
  }

  if (stage === "error") {
    return (
      <Card className="p-10 text-center">
        <p className="text-sm text-danger">{t("serverError")}</p>
      </Card>
    );
  }

  if (stage === "gate" || stage === "revealing") {
    return (
      <div className="animate-fade-up">
        <div className="-mb-3 flex justify-center">
          <GuardianCat />
        </div>
      <Card className="relative p-8 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent/10 border border-accent/25">
          {meta?.hasPassphrase ? (
            <KeyRound className="size-7 text-accent-soft" />
          ) : (
            <Eye className="size-7 text-accent-soft" />
          )}
        </div>
        <h1 className="mt-4 text-xl font-semibold">{t("gateTitle")}</h1>
        <p className="mt-2 text-sm text-ink-faint">
{meta?.hasPassphrase ? t("gatePassphrase") : t("gateReveal")}
        </p>

        {meta?.expiresAt && <Countdown expiresAt={meta.expiresAt} onExpire={expire} />}

        {/* Security preamble: helps the recipient decide whether to open */}
        <div className="mt-5 rounded-xl border border-warn/25 bg-warn/[0.06] p-4 text-left">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-warn">
            <ShieldAlert className="size-3.5 shrink-0" />
            {t("safetyTitle")}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">{t("safetyCaution")}</p>
          <p className="mt-2 text-xs leading-relaxed text-ink-dim">{t("safetyTrust")}</p>
        </div>

        {meta?.hasPassphrase && (
          <Input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && reveal()}
            placeholder={t("passphrasePlaceholder")}
            className="mt-5 text-center"
            autoFocus
          />
        )}

        {error && <div className="mt-4"><ErrorText>{error}</ErrorText></div>}

        <Button
          onClick={() => reveal()}
          loading={stage === "revealing"}
          className="mt-5 w-full py-3"
          disabled={meta?.hasPassphrase && !passphrase}
        >
          <Eye className="size-4" />
          {t("reveal")}
        </Button>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-ink-faint">
          <ShieldCheck className="size-3.5 text-ok" />
          {t("localNote")}
        </p>
      </Card>
      </div>
    );
  }

  // revealed: the keeper is happy — the secret arrived safely
  return (
    <div className="animate-fade-up">
      <div className="-mb-3 flex justify-center">
        <GuardianCat happy />
      </div>
    <Card className="relative p-8">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-ok/10 border border-ok/25">
          <ShieldCheck className="size-5 text-ok" />
        </span>
        <div>
          <h1 className="font-semibold">{t("revealedTitle")}</h1>
          <p className="text-xs text-ink-faint">{t("revealedNote")}</p>
        </div>
      </div>

      <div className="mt-6">
        {payload?.t === "URL" ? (
          <UrlReveal url={payload.d} autoOpen={autoOpen} />
        ) : payload?.t === "FILE" ? (
          <div className="rounded-xl border border-line bg-bg-soft p-5 text-center">
            <p className="font-medium text-ink break-all">{payload.name}</p>
            <p className="mt-1 text-xs text-ink-faint">
              {payload.size ? t("fileSize", { size: (payload.size / 1024 / 1024).toFixed(2) }) : ""}
            </p>
            {dlProgress !== null && dlProgress < 100 && (
              <div className="mx-auto mt-3 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-line">
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${dlProgress}%` }}
                />
              </div>
            )}
            <Button
              onClick={downloadFile}
              className="mt-4"
              disabled={dlProgress !== null && dlProgress < 100}
            >
              <Download className="size-4" />
              {dlProgress === 100
                ? t("downloaded")
                : dlProgress !== null
                  ? t("decryptingPct", { pct: dlProgress })
                  : t("download")}
            </Button>
          </div>
        ) : (
          <SecretText value={payload?.d ?? ""} mono={payload?.t === "PASSWORD"} />
        )}
      </div>

      {error && <div className="mt-4"><ErrorText>{error}</ErrorText></div>}

      {deletable && (
        <div className="mt-6 border-t border-line pt-4 text-center">
          <button
            onClick={burn}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-danger transition-colors hover:text-danger/80 cursor-pointer"
          >
            <Flame className="size-3.5" />
            {t("burnAction")}
          </button>
        </div>
      )}
    </Card>

    <div className="mt-5 rounded-2xl border border-line bg-panel/40 p-5 text-center">
      <p className="text-sm font-medium text-ink">{t("thanksTitle")}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-ink-dim">{t("thanksText")}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2.5">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white shadow-[0_4px_20px_-4px_var(--accent-glow)] transition-all hover:bg-accent-soft"
        >
          <Lock className="size-4" />
          {t("thanksCreate")}
        </Link>
        <Link
          href="/about"
          className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-sm text-ink-dim transition-colors hover:border-line-soft hover:text-ink"
        >
          {t("thanksAbout")}
        </Link>
      </div>
    </div>
    </div>
  );
}

/** Countdown before expiry — nudges the recipient to open quickly. */
function Countdown({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const t = useTranslations("viewer");
  const locale = useLocale();
  const target = new Date(expiresAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const left = target - Date.now();
      setNow(Date.now());
      if (left <= 0) {
        clearInterval(id);
        onExpire();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [target, onExpire]);

  const total = Math.max(0, target - now);
  const s = Math.floor(total / 1000) % 60;
  const m = Math.floor(total / 60_000) % 60;
  const h = Math.floor(total / 3_600_000) % 24;
  const d = Math.floor(total / 86_400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const time =
    d > 0
      ? `${d}${locale === "fr" ? "j" : "d"} ${pad(h)}:${pad(m)}:${pad(s)}`
      : `${pad(h)}:${pad(m)}:${pad(s)}`;

  const urgent = total <= 60 * 60_000; // < 1 h
  const critical = total <= 5 * 60_000; // < 5 min

  return (
    <div
      className={cls(
        "mt-5 flex flex-col items-center gap-1 rounded-xl border px-4 py-3",
        critical
          ? "border-danger/40 bg-danger/10"
          : urgent
            ? "border-warn/40 bg-warn/10"
            : "border-line bg-bg-soft/60"
      )}
    >
      <span className="flex items-center gap-1.5 text-xs text-ink-faint">
        <Clock className="size-3.5" /> {t("countdownLabel")}
      </span>
      <span
        className={cls(
          "font-mono text-2xl font-semibold tabular-nums tracking-wider",
          critical
            ? "text-danger animate-pulse"
            : urgent
              ? "text-warn"
              : "text-accent-soft"
        )}
      >
        {time}
      </span>
      <span className="text-[11px] text-ink-faint">{t("countdownHint")}</span>
    </div>
  );
}

function SecretText({ value, mono }: { value: string; mono: boolean }) {
  const tSecret = useTranslations("viewer")("copySecret");
  return (
    <div className="space-y-3">
      <div
        className={cls(
          "max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-line bg-bg-soft px-4 py-3 text-sm",
          mono && "font-mono text-base tracking-wide"
        )}
      >
        {value}
      </div>
      <div className="flex justify-center">
        <CopyButton value={value} label={tSecret} big />
      </div>
    </div>
  );
}

function UrlReveal({ url, autoOpen }: { url: string; autoOpen: boolean }) {
  const t = useTranslations("viewer");

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
  const auto = sameOrigin || autoOpen;

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
    <div className="rounded-xl border border-line bg-bg-soft p-5 text-center">
      <p className="break-all font-mono text-sm text-accent-soft">{url}</p>
      {auto ? (
        <p className="mt-3 text-xs text-ink-faint">{t("redirect", { s: count })}</p>
      ) : (
        <p className="mt-3 inline-flex items-center justify-center gap-1.5 text-xs text-warn">
          <AlertTriangle className="size-3.5" /> {t("urlCheckBeforeOpen")}
        </p>
      )}
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Button onClick={() => (window.location.href = url)}>
          <ExternalLink className="size-4" />
          {t("openNow")}
        </Button>
        <CopyButton value={url} label={t("copyUrl")} />
      </div>
    </div>
  );
}
