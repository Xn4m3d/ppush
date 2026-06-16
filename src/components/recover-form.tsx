"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LifeBuoy, ShieldCheck, Fingerprint, CheckCircle2 } from "lucide-react";
import { Button, Card, Input, Textarea, Field, ErrorText } from "./ui";
import { Turnstile, type TurnstileHandle } from "./turnstile";
import { isValidEmail } from "@/lib/validation";

/**
 * Public access-recovery request. ppush sends no automatic reset email (a
 * security choice): the request goes to the admin area where a human verifies
 * identity, then relays a reset link out-of-band.
 */
export function RecoverForm({ turnstileSiteKey }: { turnstileSiteKey?: string }) {
  const t = useTranslations("recover");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const needsCaptcha = !!turnstileSiteKey;
  const ready = isValidEmail(email) && message.trim().length >= 10 && (!needsCaptcha || !!captchaToken);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          message,
          contact: contact.trim() || undefined,
          turnstileToken: captchaToken || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("genericError"));
        if (needsCaptcha) {
          turnstileRef.current?.reset();
          setCaptchaToken("");
        }
        return;
      }
      setSent(true);
    } catch {
      setError(t("genericError"));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <Card className="w-full max-w-md p-8 text-center animate-fade-up">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-ok/25 bg-ok/10">
          <CheckCircle2 className="size-7 text-ok" />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">{t("sentTitle")}</h1>
        <p className="mt-2 text-sm text-ink-dim">{t("sentBody")}</p>
        <p className="mt-3 text-xs text-ink-faint">{t("sentReminder")}</p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center justify-center rounded-xl border border-line px-5 py-2.5 text-sm text-ink-dim transition-colors hover:border-line-soft hover:text-ink"
        >
          {t("backToLogin")}
        </Link>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg p-8 animate-fade-up">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-accent/25 bg-accent/10">
          <LifeBuoy className="size-5.5 text-accent-soft" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-ink-faint">{t("subtitle")}</p>
        </div>
      </div>

      {/* Procedure — we own the "no email" choice and explain it */}
      <div className="mt-6 space-y-2.5 rounded-xl border border-line bg-bg-soft/40 p-4 text-sm text-ink-dim">
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent-soft" />
          <span>{t("noEmail")}</span>
        </p>
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent-soft" />
          <span>{t("humanVerified")}</span>
        </p>
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent-soft" />
          <span>{t("prepareProof")}</span>
        </p>
      </div>

      {/* Passkey tip: the best self-recovery */}
      <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-accent/25 bg-accent/[0.07] px-4 py-3 text-sm text-ink-dim">
        <Fingerprint className="mt-0.5 size-4 shrink-0 text-accent-soft" />
        <span>
          {t.rich("passkeyTip", {
            link: (chunks) => (
              <Link href="/about#faq" className="text-accent-soft hover:underline">
                {chunks}
              </Link>
            ),
          })}
        </span>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label={t("emailLabel")} hint={t("emailHint")}>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            maxLength={255}
            aria-invalid={!!email && !isValidEmail(email)}
            required
          />
        </Field>
        <Field label={t("messageLabel")} hint={t("messageHint")}>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("messagePlaceholder")}
            rows={5}
            maxLength={2000}
            required
          />
        </Field>
        <Field label={t("contactLabel")} hint={t("contactHint")}>
          <Input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder={t("contactPlaceholder")}
            maxLength={200}
          />
        </Field>
        {needsCaptcha && <Turnstile ref={turnstileRef} siteKey={turnstileSiteKey!} onToken={setCaptchaToken} />}
        <ErrorText>{error}</ErrorText>
        <Button type="submit" loading={loading} className="w-full" disabled={!ready}>
          {t("submit")}
        </Button>
      </form>
    </Card>
  );
}
