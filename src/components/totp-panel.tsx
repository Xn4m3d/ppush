"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { Badge, Button, Card, Field, Input, ErrorText } from "./ui";

export function TotpPanel({
  initialEnabled,
  hasPassword,
}: {
  initialEnabled: boolean;
  hasPassword: boolean;
}) {
  const t = useTranslations("totp");
  const tc = useTranslations("common");
  const [enabled, setEnabled] = useState(initialEnabled);
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [disabling, setDisabling] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (setup) {
      QRCode.toDataURL(setup.uri, {
        width: 200,
        margin: 1,
        color: { dark: "#eef1f8", light: "#141823" },
      }).then(setQr);
    }
  }, [setup]);

  async function startSetup() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/account/totp", { method: "POST" });
    const data = await res.json();
    if (res.ok) setSetup(data);
    else setError(data.error ?? tc("error"));
    setBusy(false);
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/account/totp", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (res.ok) {
      setEnabled(true);
      setSetup(null);
      setCode("");
    } else {
      setError(data.error ?? tc("error"));
    }
    setBusy(false);
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/account/totp", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(hasPassword ? { password, code } : { code }),
    });
    const data = await res.json();
    if (res.ok) {
      setEnabled(false);
      setDisabling(false);
      setPassword("");
      setCode("");
    } else {
      setError(data.error ?? tc("error"));
    }
    setBusy(false);
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{t("title")}</h2>
        {enabled ? (
          <Badge tone="ok">
            <ShieldCheck className="size-3" /> {t("enabled")}
          </Badge>
        ) : (
          <Badge tone="warn">
            <ShieldOff className="size-3" /> {t("disabled")}
          </Badge>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-faint">{t("intro")}</p>

      {!enabled && !setup && (
        <Button onClick={startSetup} loading={busy} className="mt-4">
          <Smartphone className="size-4" />
          {t("enable")}
        </Button>
      )}

      {setup && (
        <div className="mt-4 space-y-4">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-line bg-bg-soft/50 p-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr && <img src={qr} alt={t("qrAlt")} className="rounded-lg border border-line" />}
            <p className="text-center text-xs text-ink-faint">
              {t("scan")}
              <code className="mt-1 block break-all font-mono text-[11px] text-ink-dim">
                {setup.secret}
              </code>
            </p>
          </div>
          <form onSubmit={confirm} className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder={t("codePlaceholder")}
              inputMode="numeric"
              className="text-center font-mono"
              required
            />
            <Button type="submit" loading={busy} disabled={code.length !== 6}>
              {t("confirm")}
            </Button>
          </form>
        </div>
      )}

      {enabled && !disabling && (
        <Button variant="ghost" onClick={() => setDisabling(true)} className="mt-4">
          {t("disable")}
        </Button>
      )}

      {disabling && (
        <form onSubmit={disable} className="mt-4 space-y-3">
          {hasPassword && (
            <Field label={t("password")}>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>
          )}
          <Field label={t("currentCode")}>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              className="font-mono"
              required
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="danger" loading={busy}>
              {t("disableConfirm")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setDisabling(false)}>
              {tc("cancel")}
            </Button>
          </div>
        </form>
      )}

      {error && <div className="mt-3"><ErrorText>{error}</ErrorText></div>}
    </Card>
  );
}
