"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, cls } from "./ui";
import { ThemeSwitcher } from "./theme-switcher";
import {
  DefaultsPanel,
  ShareMessagesPanel,
  PasswordPanel,
  TokensPanel,
  DeleteAccountPanel,
} from "./account-panel";
import { PasskeysPanel } from "./passkeys-panel";
import { TotpPanel } from "./totp-panel";
import type { ThemeChoice } from "@/lib/themes";

type Defaults = {
  defaultDays: number;
  defaultViews: number;
  defaultRetrievalStep: boolean;
  defaultDeletableByViewer: boolean;
  autoOpenUrls: boolean;
};
type ShareMessages = { password: string; text: string; file: string; url: string };
type Tab = "pushes" | "account" | "security";

/** Account settings, organized into sub-tabs: Pushes · Account · Security. */
export function AccountTabs({
  defaults,
  shareInitial,
  shareDefaults,
  themeChoice,
  hasPassword,
  has2fa,
  canDelete,
  email,
}: {
  defaults: Defaults;
  shareInitial: ShareMessages;
  shareDefaults: ShareMessages;
  themeChoice: ThemeChoice;
  hasPassword: boolean;
  has2fa: boolean;
  canDelete: boolean;
  email: string;
}) {
  const t = useTranslations("account");
  const [tab, setTab] = useState<Tab>("pushes");

  const tabs: [Tab, string][] = [
    ["pushes", t("tabPushes")],
    ["account", t("tabAccount")],
    ["security", t("tabSecurity")],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1 border-b border-line">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cls(
              "relative shrink-0 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer",
              tab === id ? "text-ink" : "text-ink-faint hover:text-ink-dim"
            )}
          >
            {label}
            {tab === id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>

      {tab === "pushes" && (
        <div className="space-y-6">
          <DefaultsPanel initial={defaults} />
          <ShareMessagesPanel initial={shareInitial} defaults={shareDefaults} />
        </div>
      )}

      {tab === "account" && (
        <div className="space-y-6">
          <Card className="space-y-3 p-6">
            <h2 className="font-semibold">{t("themeTitle")}</h2>
            <p className="text-sm text-ink-dim">{t("themeHint")}</p>
            <ThemeSwitcher current={themeChoice} persist />
          </Card>
        </div>
      )}

      {tab === "security" && (
        <div className="space-y-6">
          <PasskeysPanel />
          <PasswordPanel hasPassword={hasPassword} />
          <TotpPanel initialEnabled={has2fa} hasPassword={hasPassword} />
          <TokensPanel />
          {canDelete && <DeleteAccountPanel email={email} hasPassword={hasPassword} has2fa={has2fa} />}
        </div>
      )}
    </div>
  );
}
