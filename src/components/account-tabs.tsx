"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "./ui";
import { ThemeSwitcher } from "./theme-switcher";
import {
  DefaultsPanel,
  GeneratorDefaultsPanel,
  ShareMessagesPanel,
  ProfilePanel,
  PasswordPanel,
  TokensPanel,
  DeleteAccountPanel,
} from "./account-panel";
import { PasskeysPanel } from "./passkeys-panel";
import { TotpPanel } from "./totp-panel";
import type { ThemeChoice } from "@/lib/themes";
import type { GenPrefs } from "@/lib/generator-prefs";

type Defaults = {
  defaultDays: number;
  defaultViews: number;
  defaultRetrievalStep: boolean;
  defaultDeletableByViewer: boolean;
  autoOpenUrls: boolean;
};
type ShareMessages = { password: string; text: string; file: string; url: string };
type Tab = "pushes" | "account" | "security";

/**
 * Account settings, in three sections (Pushes · Account · Security) listed
 * in the left column with their settings; a click opens the section and
 * scrolls down to the setting. Cards become sections between hairlines.
 */
export function AccountTabs({
  defaults,
  generator,
  shareInitial,
  shareDefaults,
  themeChoice,
  hasPassword,
  has2fa,
  canDelete,
  email,
  name,
}: {
  defaults: Defaults;
  generator: GenPrefs | null;
  shareInitial: ShareMessages;
  shareDefaults: ShareMessages;
  themeChoice: ThemeChoice;
  hasPassword: boolean;
  has2fa: boolean;
  canDelete: boolean;
  email: string;
  name: string;
}) {
  const t = useTranslations("account");
  const tTotp = useTranslations("totp");
  const tTokens = useTranslations("tokens");
  const [tab, setTab] = useState<Tab>("pushes");
  const [sel, setSel] = useState("acc-prefs");

  const groups: [Tab, string, [string, string][]][] = [
    ["pushes", t("tabPushes"), [["acc-prefs", t("prefsTitle")], ["acc-gen", t("genTitle")], ["acc-share", t("shareTitle")]]],
    ["account", t("tabAccount"), [["acc-profile", t("profileTitle")], ["acc-theme", t("themeTitle")]]],
    [
      "security",
      t("tabSecurity"),
      [
        ["acc-passkeys", t("passkeysTitle")],
        ["acc-password", hasPassword ? t("passwordTitle") : t("setPasswordTitle")],
        ["acc-2fa", tTotp("title")],
        ["acc-tokens", tTokens("title")],
        ...(canDelete ? ([["acc-delete", t("deleteAccountTitle")]] as [string, string][]) : []),
      ],
    ],
  ];
  const open = (g: Tab, id: string) => {
    setTab(g);
    setSel(id);
    // the section renders on the next frame: we scroll to the setting afterwards
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <>
      <aside className="side">
        {groups.map(([g, label, items]) => (
          <div key={g}>
            <p className="eyebrow side-label">{label}</p>
            <ul>
              {items.map(([id, name]) => (
                <li key={id}>
                  <button type="button" className="side-item" aria-current={tab === g && sel === id ? "true" : undefined} onClick={() => open(g, id)}>
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </aside>

      <div className="app-main sets">
        {tab === "pushes" && (
          <>
            <div id="acc-prefs" className="scroll-mt-24"><DefaultsPanel initial={defaults} /></div>
            <div id="acc-gen" className="scroll-mt-24"><GeneratorDefaultsPanel initial={generator} /></div>
            <div id="acc-share" className="scroll-mt-24"><ShareMessagesPanel initial={shareInitial} defaults={shareDefaults} /></div>
          </>
        )}

        {tab === "account" && (
          <>
            <div id="acc-profile" className="scroll-mt-24">
              <ProfilePanel initialName={name} initialEmail={email} hasPassword={hasPassword} />
            </div>
            <div id="acc-theme" className="scroll-mt-24">
              <Card className="space-y-3 p-6">
                <h2 className="font-semibold">{t("themeTitle")}</h2>
                <p className="text-sm text-ink-dim">{t("themeHint")}</p>
                <ThemeSwitcher current={themeChoice} persist />
              </Card>
            </div>
          </>
        )}

        {tab === "security" && (
          <>
            <div id="acc-passkeys" className="scroll-mt-24"><PasskeysPanel /></div>
            <div id="acc-password" className="scroll-mt-24"><PasswordPanel hasPassword={hasPassword} /></div>
            <div id="acc-2fa" className="scroll-mt-24"><TotpPanel initialEnabled={has2fa} hasPassword={hasPassword} /></div>
            <div id="acc-tokens" className="scroll-mt-24"><TokensPanel /></div>
            {canDelete && (
              <div id="acc-delete" className="scroll-mt-24">
                <DeleteAccountPanel email={email} hasPassword={hasPassword} has2fa={has2fa} />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
