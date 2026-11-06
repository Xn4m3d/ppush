import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

/**
 * "Workbench" template for the account pages (login, register, recovery,
 * reset): the form on a tinted pane on the left, a clear stage
 * on the right, open onto space, saying what the account brings.
 * Narrow: the form first, the stage below.
 */
export function AuthBench({ children, stage }: { children: ReactNode; stage: ReactNode }) {
  return (
    <div className="wrap auth-bench">
      <div className="auth-ctrl">{children}</div>
      <section className="auth-stage">{stage}</section>
    </div>
  );
}

/** Login stage: the history, and what protects the account. */
export async function AccountStage() {
  const t = await getTranslations("authStage");
  return (
    <>
      <div>
        <h2 className="stage-title">{t.rich("accountTitle", { em: (c) => <em>{c}</em> })}</h2>
        <p className="stage-lede">{t("accountLede")}</p>
      </div>
      <div className="stage-tags">
        <span>{t("tagArgon")}</span>
        <span>{t("tagPasskeys")}</span>
        <span>{t("tag2fa")}</span>
        <span>{t("tagSessions")}</span>
      </div>
    </>
  );
}

/** Recovery stage: a human checks, no link by email. */
export async function RecoverStage() {
  const t = await getTranslations("authStage");
  return (
    <>
      <div>
        <h2 className="stage-title">{t.rich("recoverTitle", { em: (c) => <em>{c}</em> })}</h2>
        <p className="stage-lede">{t("recoverLede")}</p>
      </div>
      <div className="stage-tags">
        <span>{t("tagHuman")}</span>
        <span>{t("tagNoEmail")}</span>
      </div>
    </>
  );
}
