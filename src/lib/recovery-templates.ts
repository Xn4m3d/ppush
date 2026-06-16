/**
 * Reply templates for recovery requests (to copy-paste into an out-of-band
 * email). Bilingual content (prose, like the /about pages): the admin reviews,
 * acts, then copies the right reply. `{link}` is replaced by the generated reset
 * link, or by a placeholder to fill in.
 */
export type TemplateLang = "en" | "fr";
export type TemplateKind = "verified" | "moreInfo" | "declined";

export type RecoveryTemplate = { subject: string; body: string };

const LINK_PLACEHOLDER: Record<TemplateLang, string> = {
  en: "[paste the one-time reset link here]",
  fr: "[collez ici le lien de réinitialisation à usage unique]",
};

const TEMPLATES: Record<TemplateLang, Record<TemplateKind, (link: string) => RecoveryTemplate>> = {
  fr: {
    verified: (link) => ({
      subject: "Récupération de votre accès ppush",
      body: `Bonjour,

Nous avons vérifié votre identité. Voici votre lien de réinitialisation à usage unique :

${link}

Ouvrez-le pour définir un nouveau mot de passe. Ce lien n'est valable qu'une seule fois et expire rapidement ; ne le partagez avec personne. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.

Astuce : pour ne plus jamais être bloqué, ajoutez une passkey depuis votre compte — vous pourrez vous reconnecter sans mot de passe.

— ppush`,
    }),
    moreInfo: () => ({
      subject: "Votre demande de récupération ppush",
      body: `Bonjour,

Nous n'avons pas pu confirmer votre identité avec une certitude suffisante. Pour avancer, merci de nous préciser, autant que possible :

- la date approximative de création de votre compte ;
- si une passkey ou la double authentification (2FA) y est activée ;
- quelques liens que vous avez récemment créés (dates, types) ;
- tout élément que seul le titulaire du compte pourrait connaître.

Ces informations nous aident à protéger votre compte contre les usurpations.

— ppush`,
    }),
    declined: () => ({
      subject: "Votre demande de récupération ppush",
      body: `Bonjour,

Nous ne sommes pas en mesure de donner suite à votre demande : les éléments fournis ne permettent pas d'établir avec certitude que vous êtes le titulaire du compte. Par sécurité, nous ne pouvons pas en dire davantage.

À toutes fins utiles : un compte ppush ne conserve que l'historique de vos liens et vos préférences. Vos secrets sont chiffrés de bout en bout et ne sont jamais accessibles, à personne. Vous pouvez créer un nouveau compte à tout moment.

— ppush`,
    }),
  },
  en: {
    verified: (link) => ({
      subject: "Recovering your ppush access",
      body: `Hello,

We've verified your identity. Here is your one-time reset link:

${link}

Open it to set a new password. This link works only once and expires shortly; don't share it with anyone. If you didn't request this, simply ignore this message.

Tip: to never get locked out again, add a passkey from your account — you'll be able to sign in without a password.

— ppush`,
    }),
    moreInfo: () => ({
      subject: "Your ppush recovery request",
      body: `Hello,

We couldn't confirm your identity with enough confidence. To move forward, please tell us, as best you can:

- the approximate date you created the account;
- whether it has a passkey or two-factor authentication (2FA) enabled;
- a few links you recently created (dates, types);
- anything only the account owner would know.

This information helps us protect your account against impersonation.

— ppush`,
    }),
    declined: () => ({
      subject: "Your ppush recovery request",
      body: `Hello,

We're unable to proceed with your request: the information provided doesn't establish with certainty that you are the account owner. For security reasons, we can't say more.

For what it's worth: a ppush account only holds your link history and preferences. Your secrets are end-to-end encrypted and never accessible to anyone. You can create a new account at any time.

— ppush`,
    }),
  },
};

export function recoveryTemplate(lang: TemplateLang, kind: TemplateKind, link?: string): RecoveryTemplate {
  return TEMPLATES[lang][kind](link || LINK_PLACEHOLDER[lang]);
}
