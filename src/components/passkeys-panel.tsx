"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { startRegistration } from "@simplewebauthn/browser";
import { Fingerprint, Plus, Trash2 } from "lucide-react";
import { Button, Card, Input, ErrorText } from "./ui";

type Passkey = {
  id: string;
  name: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

export function PasskeysPanel() {
  const t = useTranslations("account");
  const locale = useLocale();
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  // computed at render (no setState in an effect); virtually all modern
  // browsers support WebAuthn → default true in SSR.
  const supported =
    typeof window === "undefined" || typeof window.PublicKeyCredential !== "undefined";

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/passkeys").then(async (res) => {
      if (res.ok && !cancelled) setPasskeys((await res.json()).passkeys);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function add() {
    setBusy(true);
    setError("");
    try {
      const optRes = await fetch("/api/account/passkeys", { method: "POST" });
      if (!optRes.ok) throw new Error((await optRes.json()).error);
      const { options } = await optRes.json();
      const attResp = await startRegistration({ optionsJSON: options });
      const verRes = await fetch("/api/account/passkeys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: attResp, name }),
      });
      if (!verRes.ok) throw new Error((await verRes.json()).error);
      setName("");
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t("passkeyError"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm(t("passkeyRemoveConfirm"))) return;
    const res = await fetch("/api/account/passkeys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? t("passkeyError"));
      return;
    }
    setRefreshKey((k) => k + 1);
  }

  return (
    <Card className="p-6">
      <h2 className="font-semibold">{t("passkeysTitle")}</h2>
      <p className="mt-1 text-xs text-ink-faint">{t("passkeysIntro")}</p>

      {!supported ? (
        <p className="mt-4 text-sm text-warn">{t("passkeyUnsupported")}</p>
      ) : (
        <>
          <div className="mt-4 flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("passkeyNamePlaceholder")}
              maxLength={60}
            />
            <Button onClick={add} loading={busy} className="shrink-0">
              <Plus className="size-4" />
              <span className="hidden sm:inline">{t("addPasskey")}</span>
            </Button>
          </div>
          {error && (
            <div className="mt-3">
              <ErrorText>{error}</ErrorText>
            </div>
          )}
          <div className="mt-4 space-y-2">
            {passkeys.length === 0 && (
              <p className="text-sm text-ink-faint">{t("noPasskeys")}</p>
            )}
            {passkeys.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-bg-soft/50 px-4 py-3"
              >
                <Fingerprint className="size-4 shrink-0 text-accent-soft" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{p.name || "Passkey"}</p>
                  <p className="text-xs text-ink-faint">
                    {t("passkeyCreatedOn", {
                      date: new Date(p.createdAt).toLocaleDateString(locale),
                    })}
                    {p.lastUsedAt
                      ? t("passkeyLastUsed", {
                          date: new Date(p.lastUsedAt).toLocaleDateString(locale),
                        })
                      : t("passkeyNeverUsed")}
                  </p>
                </div>
                <button
                  onClick={() => remove(p.id)}
                  className="text-ink-faint transition-colors hover:text-danger cursor-pointer"
                  title={t("passkeyRemove")}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
