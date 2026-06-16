"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, KeyRound, Fingerprint, Sparkles } from "lucide-react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { Button, Input, Field, Card, ErrorText } from "./ui";
import { Turnstile, type TurnstileHandle } from "./turnstile";
import { isValidEmail } from "@/lib/validation";

export function AuthForm({
  mode,
  turnstileSiteKey,
}: {
  mode: "login" | "register";
  turnstileSiteKey?: string;
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [totpTicket, setTotpTicket] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [pkLoading, setPkLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const turnstileRef = useRef<TurnstileHandle>(null);
  const needsCaptcha = mode === "register" && !!turnstileSiteKey;
  const emailValid = isValidEmail(email);
  const nameValid = name.trim().length > 0;
  const registerReady = emailValid && nameValid && (!needsCaptcha || !!captchaToken);

  function resetCaptcha() {
    if (needsCaptcha) {
      turnstileRef.current?.reset();
      setCaptchaToken("");
    }
  }

  /** Connexion passwordless par passkey. */
  async function passkeyLogin() {
    setError("");
    setPkLoading(true);
    try {
      const optRes = await fetch("/api/auth/passkey", { method: "POST" });
      if (!optRes.ok) {
        setError((await optRes.json()).error ?? t("passkeyError"));
        return;
      }
      const { flowId, options } = await optRes.json();
      const assertion = await startAuthentication({ optionsJSON: options });
      const verRes = await fetch("/api/auth/passkey", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flowId, response: assertion }),
      });
      const data = await verRes.json();
      if (!verRes.ok) {
        setError(data.error ?? t("passkeyError"));
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError(t("passkeyError"));
    } finally {
      setPkLoading(false);
    }
  }

  /** Passwordless sign-up: creates the account with a passkey, no password. */
  async function passkeyRegister() {
    setError("");
    setPkLoading(true);
    try {
      const optRes = await fetch("/api/auth/register-passkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, turnstileToken: captchaToken }),
      });
      const optData = await optRes.json();
      if (!optRes.ok) {
        setError(optData.error ?? t("genericError"));
        resetCaptcha();
        return;
      }
      const attResp = await startRegistration({ optionsJSON: optData.options });
      const verRes = await fetch("/api/auth/register-passkey", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flowId: optData.flowId, response: attResp }),
      });
      const data = await verRes.json();
      if (!verRes.ok) {
        setError(data.error ?? t("genericError"));
        resetCaptcha();
        return;
      }
      if (data.pending) {
        setPending(true);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError(t("passkeyError"));
      resetCaptcha();
    } finally {
      setPkLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "login"
            ? { email, password }
            : { email, name, password, turnstileToken: captchaToken }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("genericError"));
        resetCaptcha(); // single-use Turnstile token: re-arm after a failure
        return;
      }
      if (data.pending) {
        setPending(true);
        return;
      }
      if (data.totpRequired) {
        setTotpTicket(data.ticket);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError(t("serverUnreachable"));
    } finally {
      setLoading(false);
    }
  }

  async function submitTotp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: totpTicket, code: totpCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("wrongCode"));
        if (res.status === 401 && data.code === "ticket_expired") {
          setTotpTicket(null);
          setTotpCode("");
        }
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError(t("serverUnreachable"));
    } finally {
      setLoading(false);
    }
  }

  if (pending) {
    return (
      <Card className="w-full max-w-md p-8 text-center animate-fade-up">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-ok/10 border border-ok/25">
          <ShieldCheck className="size-7 text-ok" />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          {t("pendingTitle")}
        </h1>
        <p className="mt-2 text-sm text-ink-dim">
          {t.rich("pendingBody", { strong: (chunks) => <strong>{chunks}</strong> })}
        </p>
      </Card>
    );
  }

  if (totpTicket) {
    return (
      <Card className="w-full max-w-md p-8 animate-fade-up">
        <div className="mx-auto grid size-12 place-items-center rounded-xl bg-accent/10 border border-accent/25">
          <KeyRound className="size-6 text-accent-soft" />
        </div>
        <h1 className="mt-4 text-center text-xl font-semibold tracking-tight">
          {t("totpTitle")}
        </h1>
        <p className="mt-1 text-center text-sm text-ink-faint">{t("totpSubtitle")}</p>
        <form onSubmit={submitTotp} className="mt-6 space-y-4">
          <Input
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            className="text-center font-mono text-xl sm:text-xl tracking-[0.5em]"
            autoFocus
            required
          />
          <ErrorText>{error}</ErrorText>
          <Button type="submit" loading={loading} className="w-full" disabled={totpCode.length !== 6}>
            {t("validate")}
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md p-8 animate-fade-up">
      <h1 className="text-xl font-semibold tracking-tight">
        {mode === "login" ? t("loginTitle") : t("registerTitle")}
      </h1>
      <p className="mt-1 text-sm text-ink-faint">
        {mode === "login" ? t("loginSubtitle") : t("registerSubtitle")}
      </p>

      {/* Fields required for sign-up (passkey OR password) */}
      {mode === "register" && (
        <div className="mt-6 space-y-4">
          <Field label={t("name")}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              autoComplete="name"
              maxLength={100}
            />
          </Field>
          <Field label={t("email")}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              autoComplete="email"
              maxLength={255}
              aria-invalid={!!email && !emailValid}
            />
            {!!email && !emailValid && (
              <span className="block text-xs text-danger">{t("invalidEmail")}</span>
            )}
          </Field>
          {needsCaptcha && (
            <Turnstile ref={turnstileRef} siteKey={turnstileSiteKey!} onToken={setCaptchaToken} />
          )}
        </div>
      )}

      {/* Passkey — the featured method */}
      <div className="mt-6">
        <div className="flex items-start gap-3 rounded-xl border border-accent/25 bg-accent/[0.07] px-4 py-3">
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-accent/25 bg-accent/10">
            <Fingerprint className="size-4 text-accent-soft" />
          </span>
          <p className="text-sm text-ink-dim">{t("passkeyHero")}</p>
        </div>
        <Button
          type="button"
          onClick={mode === "login" ? passkeyLogin : passkeyRegister}
          loading={pkLoading}
          className="mt-3 w-full py-3 text-base"
          disabled={mode === "register" && !registerReady}
        >
          <Fingerprint className="size-4" />
          {mode === "login" ? t("passkeySignIn") : t("signupPasskey")}
        </Button>
      </div>

      {error && (
        <div className="mt-4">
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      {/* Password — secondary, collapsed by default */}
      {!showPassword ? (
        <button
          type="button"
          onClick={() => setShowPassword(true)}
          className="mt-5 block w-full text-center text-xs text-ink-faint transition-colors hover:text-ink-dim cursor-pointer"
        >
          {t("usePasswordInstead")}
        </button>
      ) : (
        <form onSubmit={submit} className="mt-5 space-y-4 border-t border-line/60 pt-5">
          {mode === "login" && (
            <Field label={t("email")}>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                autoComplete="email"
                maxLength={255}
                required
              />
            </Field>
          )}
          <Field
            label={mode === "register" ? t("passwordOptional") : t("password")}
            hint={mode === "register" ? t("passwordHint") : undefined}
          >
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "register" ? 12 : undefined}
              required={mode === "login"}
            />
          </Field>
          <Button
            type="submit"
            variant="subtle"
            loading={loading}
            className="w-full"
            disabled={mode === "register" && (!registerReady || password.length < 12)}
          >
            {mode === "login" ? t("login") : t("createWithPassword")}
          </Button>
        </form>
      )}

      {mode === "login" && (
        <div className="mt-5 text-center">
          <Link
            href="/recover"
            className="text-xs text-ink-faint underline-offset-2 transition-colors hover:text-ink-dim hover:underline"
          >
            {t("troubleSignIn")}
          </Link>
        </div>
      )}

      {mode === "login" ? (
        <div className="mt-6 text-center">
          <p className="text-sm text-ink-faint">{t("noAccount")}</p>
          <Link
            href="/register"
            className="mt-2 inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-5 py-2.5 text-sm font-medium text-accent-soft transition-all hover:-translate-y-0.5 hover:border-accent/60 hover:bg-accent/20"
          >
            <Sparkles className="size-4" />
            {t("signup")}
          </Link>
        </div>
      ) : (
        <p className="mt-6 text-center text-sm text-ink-faint">
          {t("haveAccount")}{" "}
          <Link href="/login" className="text-accent-soft hover:underline">
            {t("signin")}
          </Link>
        </p>
      )}
    </Card>
  );
}
