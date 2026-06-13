import Link from "next/link";
import { Lock, TerminalSquare, AlertTriangle, BookOpenText } from "lucide-react";
import { config } from "@/lib/config";
import { Code, H2, Endpoint } from "./blocks";

/** French content of the API docs. Mirror: content.en.tsx. */
export function ApiDocsContentFr() {
  const base = config.baseUrl;
  return (
    <>
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Documentation API</h1>
        <p className="max-w-xl text-ink-dim">
          Créez des pushes par script — provisioning, onboarding, CI — tout en
          conservant le chiffrement de bout en bout.
        </p>
      </div>

      <div className="mt-12 space-y-10">
        <section className="space-y-4">
          <H2 id="auth">Authentification</H2>
          <p className="text-sm text-ink-dim">
            Générez un token personnel dans{" "}
            <Link href="/account" className="text-accent-soft hover:underline">
              Compte → Tokens API
            </Link>{" "}
            (affiché une seule fois), puis passez-le en en-tête :
          </p>
          <Code copy>{`Authorization: Bearer ppush_xxxxxxxxxxxxxxxxxxxx`}</Code>
          <p className="flex items-start gap-2 rounded-xl border border-warn/25 bg-warn/5 px-4 py-3 text-sm text-ink-dim">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
            <span>
              <strong className="text-ink">L&apos;API n&apos;accepte que des contenus déjà chiffrés.</strong>{" "}
              Le serveur ne chiffre jamais lui-même — c&apos;est ce qui garantit le
              zéro-knowledge. Utilisez le CLI fourni (recommandé) ou implémentez
              le format ci-dessous.
            </span>
          </p>
        </section>

        <section className="space-y-4">
          <H2 id="cli">
            <span className="inline-flex items-center gap-2">
              <TerminalSquare className="size-5 text-accent-soft" />
              Le CLI (recommandé)
            </span>
          </H2>
          <p className="text-sm text-ink-dim">
            <code className="rounded bg-bg-soft px-1.5 py-0.5 font-mono text-xs">tools/ppush-cli.mjs</code>{" "}
            (dans le dépôt) chiffre localement puis appelle l&apos;API. Node ≥ 20,
            aucune dépendance.
          </p>
          <Code copy>{`export PPUSH_URL=${base}
export PPUSH_TOKEN=ppush_xxx

# mot de passe, 3 vues max, 7 jours
ppush-cli.mjs --password "S3cret!" --views 3 --days 7

# texte depuis stdin
cat config.yml | ppush-cli.mjs --text -

# fichier avec passphrase et note privée
ppush-cli.mjs --file dump.sql.gz --passphrase "sesame" --note "backup pour Bob"

# → imprime l'URL complète, clé de déchiffrement incluse dans le fragment`}</Code>
          <p className="text-xs text-ink-faint">
            Options : <code>--days N</code> · <code>--views N</code> ·{" "}
            <code>--passphrase X</code> · <code>--note &quot;…&quot;</code> ·{" "}
            <code>--no-retrieval-step</code> · <code>--no-deletable</code>
          </p>
        </section>

        <section className="space-y-4">
          <H2 id="endpoints">Endpoints</H2>

          <Endpoint method="POST" path="/api/pushes" auth="Bearer ou session">
            <p>Crée un push. Corps JSON :</p>
            <Code>{`{
  "kind": "PASSWORD" | "TEXT" | "FILE" | "URL",
  "ciphertext": "<base64>",          // payload chiffré (cf. format)
  "blobPath": "xxx.bin",             // FILE uniquement (cf. POST /api/blobs)
  "passphrase": "optionnelle",
  "expireAfterMinutes": 10080,       // 5..${config.limits.user.maxDays * 1440} (min 5 ; "expireAfterDays" en jours encore accepté)
  "expireAfterViews": 5,             // 1..${config.limits.user.maxViews}
  "retrievalStep": true,
  "deletableByViewer": true,
  "note": "référence privée optionnelle"
}`}</Code>
            <p>
              Réponse <code>201</code> : <code>{`{ "slug", "url", "expiresAt", … }`}</code>.
              Le lien à transmettre est <code>url + &quot;#&quot; + clé_base64url</code> —
              la clé n&apos;est connue que de vous.
            </p>
          </Endpoint>

          <Endpoint method="POST" path="/api/blobs" auth="Bearer ou session">
            <p>
              Upload du blob chiffré d&apos;un fichier (corps brut, max ~
              {config.limits.user.maxFileMb} Mo avec un compte). Réponse :{" "}
              <code>{`{ "blobPath": "xxx.bin", "size": 123 }`}</code> à passer
              ensuite à <code>POST /api/pushes</code>.
            </p>
          </Endpoint>

          <Endpoint method="GET" path="/api/pushes?page=1&filter=active" auth="Bearer ou session">
            <p>
              Liste paginée de vos pushes. <code>filter</code> :{" "}
              <code>active</code> | <code>expired</code> | (omis = tous).
            </p>
          </Endpoint>

          <Endpoint method="GET" path="/api/pushes/:slug" auth="Bearer ou session">
            <p>
              Détail d&apos;un push + journal d&apos;audit complet (<code>events</code> :
              CREATED, VIEW, FAILED_PASSPHRASE, EXPIRED, OWNER_DELETE,
              VIEWER_DELETE, avec IP et user-agent).
            </p>
          </Endpoint>

          <Endpoint method="DELETE" path="/api/pushes/:slug" auth="Bearer ou session">
            <p>Fait expirer le push immédiatement (purge définitive du payload).</p>
          </Endpoint>

          <Endpoint method="GET" path="/api/p/:slug" auth="public">
            <p>
              Métadonnées publiques d&apos;un push (type, expiré ou non, passphrase
              requise…). Ne consomme pas de vue.
            </p>
          </Endpoint>

          <Endpoint method="POST" path="/api/p/:slug/reveal" auth="public">
            <p>
              Révèle le ciphertext et <strong className="text-ink">consomme une vue</strong>. Corps :{" "}
              <code>{`{ "passphrase": "…" }`}</code> si exigée. Pour un FILE,
              retourne aussi un <code>viewToken</code> à usage unique pour{" "}
              <code>GET /api/p/:slug/blob?vt=…</code>.
            </p>
          </Endpoint>

          <Endpoint method="POST" path="/api/p/:slug/burn" auth="public">
            <p>Destruction par le destinataire (si autorisée à la création).</p>
          </Endpoint>

          <Endpoint method="GET" path="/api/storage" auth="public">
            <p>
              Fair-use transparent du stockage fichiers :{" "}
              <code>{`{ "availableBytes", "upcoming": [{ "bytes", "at" }] }`}</code>{" "}
              — <code>upcoming</code> liste les libérations d&apos;espace à venir
              (cumulées, par date d&apos;expiration au plus tard). Authentifié,
              ajoute <code>{`"user": { "usedBytes", "availableBytes", "quotaBytes" }`}</code>{" "}
              (quota personnel de fichiers actifs). Un upload refusé faute
              d&apos;espace renvoie <code>507</code> avec l&apos;estimation de la
              prochaine fenêtre.
            </p>
          </Endpoint>
        </section>

        <section className="space-y-4">
          <H2 id="crypto">
            <span className="inline-flex items-center gap-2">
              <Lock className="size-5 text-accent-soft" />
              Format de chiffrement (v1)
            </span>
          </H2>
          <p className="text-sm text-ink-dim">
            Si vous n&apos;utilisez pas le CLI, produisez le ciphertext ainsi
            (AES-256-GCM, WebCrypto ou équivalent) :
          </p>
          <Code>{`Clé      : 32 octets aléatoires → base64url → fragment du lien (#…)
Payload  : JSON { "t": "PASSWORD|TEXT|URL", "d": "<secret>" }
           (FILE : { "t":"FILE", "d":"", "name", "mime", "size" })

ciphertext = 0x01 ‖ IV(12 octets) ‖ AES-256-GCM(payload, AAD="ppush:v1:meta")
           → base64 dans le champ "ciphertext"

Fichiers (blob) : chunks de 8 Mio, chacun encadré :
  [longueur u32 BE] [IV 12 octets] [ct+tag]
  AAD du chunk i : "ppush:v1:<i>:<1 si dernier, sinon 0>"`}</Code>
        </section>

        <section className="space-y-4">
          <H2 id="errors">Limites & erreurs</H2>
          <ul className="list-inside list-disc space-y-1.5 text-sm text-ink-dim">
            <li>
              Réponses d&apos;erreur : <code>{`{ "error": "message" }`}</code> avec le
              statut HTTP approprié (<code>400</code> validation,{" "}
              <code>401</code> auth, <code>403</code> interdit, <code>404</code>{" "}
              introuvable, <code>409</code> conflit, <code>410</code> expiré,{" "}
              <code>413</code> trop volumineux, <code>429</code> rate limit).
            </li>
            <li>
              Rate limiting par IP sur les endpoints sensibles (login,
              passphrase, reveal). En cas de <code>429</code>, attendez puis
              réessayez.
            </li>
            <li>
              Payload texte chiffré : {config.maxTextSizeKb} Ko max · fichiers :{" "}
              {config.limits.user.maxFileMb} Mo max (compte) · rétention :{" "}
              {config.limits.user.maxDays} jours / {config.limits.user.maxViews} vues max.
              Sans compte : {config.limits.anon.maxDays} jours /{" "}
              {config.limits.anon.maxViews} vues, fichiers {config.limits.anon.maxFileMb} Mo.
            </li>
            <li>
              Stockage fichiers fair-use : espace global partagé (voir{" "}
              <code>GET /api/storage</code>) + quota personnel de{" "}
              {config.userStorageQuotaGb} Go de fichiers actifs par compte.
              Saturation → <code>507</code> avec l&apos;estimation des prochaines
              libérations d&apos;espace.
            </li>
            <li>
              Un token API a les droits de son propriétaire (création, listing,
              expiration de <em>ses</em> pushes). Révocable à tout moment depuis
              le compte.
            </li>
          </ul>
        </section>

        <p className="flex items-center justify-center gap-2 pt-4 text-sm text-ink-faint">
          <BookOpenText className="size-4" />
          Voir aussi{" "}
          <Link href="/about" className="text-accent-soft hover:underline">
            la page À propos
          </Link>{" "}
          et{" "}
          <Link href="/account" className="text-accent-soft hover:underline">
            la gestion des tokens
          </Link>
          .
        </p>
      </div>
    </>
  );
}
