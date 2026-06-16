"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { startAuthentication } from "@simplewebauthn/browser";
import { KeyRound, Plus, Trash2, Save, TriangleAlert } from "lucide-react";
import { Button, Card, Field, Input, Toggle, ErrorText } from "./ui";
import { CopyButton } from "./copy-button";

type Defaults = {
  defaultDays: number;
  defaultViews: number;
  defaultRetrievalStep: boolean;
  defaultDeletableByViewer: boolean;
  autoOpenUrls: boolean;
};

export function DefaultsPanel({ initial }: { initial: Defaults }) {
  const t = useTranslations("account");
  const tc = useTranslations("common");
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/account/defaults", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? tc("error"));
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setBusy(false);
  }

  return (
    <Card className="p-6 space-y-4">
      <h2 className="font-semibold">{t("prefsTitle")}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("defaultDays")}>
          <Input
            type="number"
            min={1}
            value={values.defaultDays}
            onChange={(e) =>
              setValues({ ...values, defaultDays: parseInt(e.target.value, 10) || 1 })
            }
          />
        </Field>
        <Field label={t("defaultViews")}>
          <Input
            type="number"
            min={1}
            value={values.defaultViews}
            onChange={(e) =>
              setValues({ ...values, defaultViews: parseInt(e.target.value, 10) || 1 })
            }
          />
        </Field>
      </div>
      <Toggle
        checked={values.defaultRetrievalStep}
        onChange={(v) => setValues({ ...values, defaultRetrievalStep: v })}
        label={t("defaultRetrieval")}
      />
      <Toggle
        checked={values.defaultDeletableByViewer}
        onChange={(v) => setValues({ ...values, defaultDeletableByViewer: v })}
        label={t("defaultDeletable")}
      />
      <Toggle
        checked={values.autoOpenUrls}
        onChange={(v) => setValues({ ...values, autoOpenUrls: v })}
        label={t("autoOpenUrls")}
        hint={t("autoOpenUrlsHint")}
      />
      <ErrorText>{error}</ErrorText>
      <Button onClick={save} loading={busy}>
        <Save className="size-4" />
        {saved ? t("saved") : t("save")}
      </Button>
    </Card>
  );
}

export function PasswordPanel({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("account");
  const tc = useTranslations("common");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setDone(false);
    try {
      const body: Record<string, unknown> = hasPassword
        ? { currentPassword: current, newPassword: next }
        : { newPassword: next };
      if (!hasPassword) {
        // passwordless account → passkey re-assertion before setting the password
        const optRes = await fetch("/api/account/password", { method: "PUT" });
        if (!optRes.ok) throw new Error((await optRes.json()).error ?? tc("error"));
        const { options } = await optRes.json();
        body.passkey = await startAuthentication({ optionsJSON: options });
      }
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? tc("error"));
      } else {
        setDone(true);
        setCurrent("");
        setNext("");
      }
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : tc("error"));
    }
    setBusy(false);
  }

  return (
    <Card className="p-6">
      <h2 className="font-semibold">
        {hasPassword ? t("passwordTitle") : t("setPasswordTitle")}
      </h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        {hasPassword && (
          <Field label={t("currentPassword")}>
            <Input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
        )}
        <Field
          label={t("newPassword")}
          hint={hasPassword ? t("newPasswordHint") : t("setPasswordHint")}
        >
          <Input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            minLength={12}
            required
          />
        </Field>
        <ErrorText>{error}</ErrorText>
        {done && (
          <p className="rounded-xl border border-ok/30 bg-ok/10 px-3.5 py-2.5 text-sm text-ok">
            {hasPassword ? t("passwordChanged") : t("passwordSet")}
          </p>
        )}
        <Button type="submit" loading={busy}>
          {hasPassword ? t("changePassword") : t("setPassword")}
        </Button>
      </form>
    </Card>
  );
}

type Token = { id: string; name: string; createdAt: string; lastUsedAt: string | null };

export function TokensPanel() {
  const t = useTranslations("tokens");
  const locale = useLocale();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [name, setName] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/tokens").then(async (res) => {
      if (res.ok && !cancelled) setTokens((await res.json()).tokens);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/account/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const data = await res.json();
      setNewToken(data.token);
      setName("");
      setRefreshKey((k) => k + 1);
    }
    setBusy(false);
  }

  async function remove(id: string) {
    if (!confirm(t("revokeConfirm"))) return;
    await fetch("/api/account/tokens", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setRefreshKey((k) => k + 1);
  }

  return (
    <Card className="p-6">
      <h2 className="font-semibold">{t("title")}</h2>
      <p className="mt-1 text-xs text-ink-faint">
        {t.rich("intro", { code: (chunks) => <code>{chunks}</code> })}
      </p>

      {newToken && (
        <div className="mt-4 rounded-xl border border-warn/30 bg-warn/10 p-4">
          <p className="text-xs font-medium text-warn">{t("created")}</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all rounded-lg bg-bg-soft px-3 py-2 font-mono text-xs">
              {newToken}
            </code>
            <CopyButton value={newToken} label="" />
          </div>
        </div>
      )}

      <form onSubmit={create} className="mt-4 flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("namePlaceholder")}
          required
        />
        <Button type="submit" loading={busy}>
          <Plus className="size-4" />
        </Button>
      </form>

      <div className="mt-4 space-y-2">
        {tokens.map((tok) => (
          <div
            key={tok.id}
            className="flex items-center gap-3 rounded-xl border border-line bg-bg-soft/50 px-4 py-3"
          >
            <KeyRound className="size-4 shrink-0 text-ink-faint" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{tok.name}</p>
              <p className="text-xs text-ink-faint">
                {t("createdOn", { date: new Date(tok.createdAt).toLocaleDateString(locale) })}
                {tok.lastUsedAt
                  ? t("lastUsed", { date: new Date(tok.lastUsedAt).toLocaleDateString(locale) })
                  : t("neverUsed")}
              </p>
            </div>
            <button
              onClick={() => remove(tok.id)}
              className="text-ink-faint transition-colors hover:text-danger cursor-pointer"
              title={t("revoke")}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function DeleteAccountPanel({
  email,
  hasPassword,
  has2fa,
}: {
  email: string;
  hasPassword: boolean;
  has2fa: boolean;
}) {
  const t = useTranslations("account");
  const tc = useTranslations("common");
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function del() {
    if (!window.confirm(t("deleteAccountFinal"))) return;
    setBusy(true);
    setError("");
    try {
      const body: Record<string, unknown> = { confirmEmail: confirm };
      if (hasPassword) {
        body.password = password;
        if (has2fa) body.code = code;
      } else {
        // passwordless account → passkey re-assertion before deletion
        const optRes = await fetch("/api/account", { method: "POST" });
        if (!optRes.ok) throw new Error((await optRes.json()).error);
        const { options } = await optRes.json();
        body.passkey = await startAuthentication({ optionsJSON: options });
      }
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? tc("error"));
        setBusy(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : tc("error"));
      setBusy(false);
    }
  }

  const matches = confirm.trim().toLowerCase() === email.toLowerCase();
  const ready =
    matches && (!hasPassword || (password.length > 0 && (!has2fa || code.length === 6)));

  return (
    <Card className="border-danger/30 p-6">
      <h2 className="flex items-center gap-2 font-semibold text-danger">
        <TriangleAlert className="size-4" />
        {t("deleteAccountTitle")}
      </h2>
      <p className="mt-1 text-sm text-ink-dim">{t("deleteAccountText")}</p>
      <div className="mt-4 space-y-3">
        <Field label={t("deleteAccountConfirm")} hint={t("deleteReauthHint")}>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={email}
            autoComplete="off"
          />
        </Field>
        {hasPassword && (
          <Field label={t("currentPassword")}>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
        )}
        {hasPassword && has2fa && (
          <Field label={t("code2fa")}>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              className="font-mono"
            />
          </Field>
        )}
        <ErrorText>{error}</ErrorText>
        <Button variant="danger" onClick={del} loading={busy} disabled={!ready}>
          <Trash2 className="size-4" />
          {t("deleteAccountButton")}
        </Button>
      </div>
    </Card>
  );
}
