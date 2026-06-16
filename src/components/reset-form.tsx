"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { KeyRound, CheckCircle2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, Input, Field, Card } from "./ui";

type State = "checking" | "invalid" | "form" | "done";

/**
 * Password reset via a single-use token delivered through a ppush push. The
 * token lives in the URL fragment (#) — never sent to the server on the initial
 * GET; we validate it, then set the new password.
 */
export function ResetForm() {
  const t = useTranslations("reset");
  const tokenRef = useRef("");
  const [state, setState] = useState<State>("checking");
  const [email, setEmail] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const tk = decodeURIComponent(window.location.hash.replace(/^#/, "")).trim();
    tokenRef.current = tk;
    let cancelled = false;
    // always query the API: an empty token returns 400 → "invalid" state.
    // setState only happens in the async callback (no cascade).
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(tk)}`)
      .then(async (r) => {
        if (cancelled) return;
        if (r.ok) {
          const d = await r.json();
          setEmail(d.email ?? null);
          setState("form");
        } else {
          setState("invalid");
        }
      })
      .catch(() => !cancelled && setState("invalid"));
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (pw !== pw2) {
      setErr(t("mismatch"));
      return;
    }
    setLoading(true);
    const r = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: tokenRef.current, newPassword: pw }),
    });
    setLoading(false);
    if (r.ok) {
      setState("done");
    } else {
      const d = await r.json().catch(() => ({}));
      setErr(d.error ?? t("genericError"));
    }
  };

  return (
    <Card className="p-6 sm:p-8">
      {state === "checking" && (
        <p className="text-center text-sm text-ink-dim">{t("checking")}</p>
      )}

      {state === "invalid" && (
        <div className="space-y-2 text-center">
          <XCircle className="mx-auto size-9 text-danger" />
          <h1 className="text-xl font-semibold tracking-tight">{t("invalidTitle")}</h1>
          <p className="text-sm text-ink-dim">{t("invalidBody")}</p>
        </div>
      )}

      {state === "form" && (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1 text-center">
            <KeyRound className="mx-auto size-8 text-accent-soft" />
            <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
            <p className="text-sm text-ink-dim">
              {email ? t("forAccount", { email }) : t("subtitle")}
            </p>
          </div>
          <Field label={t("newPassword")} hint={t("min12")}>
            <Input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              minLength={12}
              required
              autoComplete="new-password"
            />
          </Field>
          <Field label={t("confirmPassword")}>
            <Input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              required
              autoComplete="new-password"
            />
          </Field>
          {err && <p className="text-sm text-danger">{err}</p>}
          <Button type="submit" loading={loading} className="w-full">
            {t("submit")}
          </Button>
        </form>
      )}

      {state === "done" && (
        <div className="space-y-3 text-center">
          <CheckCircle2 className="mx-auto size-9 text-ok" />
          <h1 className="text-xl font-semibold tracking-tight">{t("successTitle")}</h1>
          <p className="text-sm text-ink-dim">{t("successBody")}</p>
          <Link href="/login" className="inline-block pt-1">
            <Button>{t("toLogin")}</Button>
          </Link>
        </div>
      )}
    </Card>
  );
}
