import { config } from "./config";

/**
 * Operational alerts: always in the logs, and as an ntfy notification when
 * ALERT_NTFY_URL is set. The same alert is only sent once per half hour, so the
 * phone isn't flooded during an attack.
 *
 * Format: a coloured dot says what the alert asks for (red: act, orange: soon,
 * green: settled, blue: for information) and sets the priority, a pictogram
 * names the domain; the title reads "subject: state · ppush" — the end of an
 * alert carries the same subject, so a receiver can pair them —; at most two
 * lines, the last one "→ what to do"; a tap opens the admin page. Language:
 * ALERT_LANG (fr | en, English by default). Sent as JSON: HTTP headers only
 * take ASCII, a JSON body takes any UTF-8.
 */

export type AlertKind =
  | "shield"
  | "report"
  | "closedAnon"
  | "closedAll"
  | "reopened"
  | "diskLow"
  | "diskFull"
  | "diskOk";

type Level = "red" | "orange" | "green" | "blue";
type Vars = Record<string, string | number>;
type Text = { level: Level; title: string; body: string };

const LEVELS: Record<Level, [string, number]> = {
  red: ["red_circle", 4],
  orange: ["orange_circle", 3],
  green: ["green_circle", 2],
  blue: ["large_blue_circle", 2],
};

const TEXTS: Record<"fr" | "en", Record<AlertKind, (v: Vars) => Text>> = {
  fr: {
    shield: (v) => ({
      level: "blue",
      title: "Bouclier activé · ppush",
      body: `${v.count} ${v.kind === "push" ? "liens" : "fichiers"} anonymes en une heure : Turnstile exigé pendant ${v.minutes} min.\n→ Rien à faire si c'est un pic normal.`,
    }),
    report: (v) => ({
      level: "orange",
      title: "Signalement · ppush",
      body: `« ${v.reason} » signalé sur /p/${v.slug}.\n→ Vérifier, et retirer le lien si besoin.`,
    }),
    closedAnon: (v) => ({
      level: "orange",
      title: "Créations : anonymes fermées · ppush",
      body: `Plafond horaire atteint (${v.kind === "push" ? "liens" : "fichiers"} : ${v.limit}), réouverture dans ${v.minutes} min.\n→ Vérifier l'activité ; relever le plafond si c'est légitime.`,
    }),
    closedAll: (v) => ({
      level: "red",
      title: "Créations : toutes fermées · ppush",
      body: `Plafond horaire global atteint (${v.limit}) : plus personne ne crée de lien, réouverture dans ${v.minutes} min.\n→ Vérifier l'activité ; relever le plafond si c'est légitime.`,
    }),
    reopened: () => ({ level: "green", title: "Créations : rouvertes · ppush", body: "Le plafond horaire est retombé." }),
    diskLow: (v) => ({
      level: "orange",
      title: "Disque : bas · ppush",
      body: `${v.free} Mo libres : création anonyme refusée.\n→ Faire de la place sur le serveur.`,
    }),
    diskFull: (v) => ({
      level: "red",
      title: "Disque : presque plein · ppush",
      body: `${v.free} Mo libres : plus aucune création.\n→ Faire de la place maintenant.`,
    }),
    diskOk: (v) => ({ level: "green", title: "Disque : rétabli · ppush", body: `${v.free} Mo libres, les créations reprennent.` }),
  },
  en: {
    shield: (v) => ({
      level: "blue",
      title: "Shield on · ppush",
      body: `${v.count} anonymous ${v.kind === "push" ? "links" : "files"} this hour: Turnstile required for ${v.minutes} min.\n→ Nothing to do if this is a normal peak.`,
    }),
    report: (v) => ({
      level: "orange",
      title: "Abuse report · ppush",
      body: `"${v.reason}" reported on /p/${v.slug}.\n→ Review it, and take the link down if needed.`,
    }),
    closedAnon: (v) => ({
      level: "orange",
      title: "Creation: anonymous closed · ppush",
      body: `Hourly ceiling reached (${v.kind === "push" ? "links" : "files"}: ${v.limit}), reopens in ${v.minutes} min.\n→ Check the activity; raise the ceiling if it is legitimate.`,
    }),
    closedAll: (v) => ({
      level: "red",
      title: "Creation: all closed · ppush",
      body: `Global hourly ceiling reached (${v.limit}): nobody can create a link, reopens in ${v.minutes} min.\n→ Check the activity; raise the ceiling if it is legitimate.`,
    }),
    reopened: () => ({ level: "green", title: "Creation: reopened · ppush", body: "The hourly ceiling has dropped." }),
    diskLow: (v) => ({
      level: "orange",
      title: "Disk: low · ppush",
      body: `${v.free} MB free: anonymous creation refused.\n→ Free some space on the server.`,
    }),
    diskFull: (v) => ({
      level: "red",
      title: "Disk: almost full · ppush",
      body: `${v.free} MB free: all creation refused.\n→ Free some space now.`,
    }),
    diskOk: (v) => ({ level: "green", title: "Disk: recovered · ppush", body: `${v.free} MB free, creation resumes.` }),
  },
};

const last = new Map<string, number>();
const QUIET_MS = 30 * 60_000;
/** Alert groups in progress ("closed", "disk"): their end will be announced. */
const raised = new Set<string>();

function text(kind: AlertKind, vars: Vars): Text {
  return TEXTS[config.guard.alertLang === "fr" ? "fr" : "en"][kind](vars);
}

function send(t: Text): void {
  const url = config.guard.alertNtfyUrl;
  if (!url) return;
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return;
  }
  // https://ntfy.example/ppush?auth=… → POST JSON to the root, the topic in the body
  const topic = target.pathname.replace(/^\/+|\/+$/g, "");
  target.pathname = "/";
  const [tag, priority] = LEVELS[t.level];
  void fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, title: t.title, message: t.body, priority, tags: [tag, "lock"], click: `${config.baseUrl}/admin` }),
    signal: AbortSignal.timeout(4000),
  }).catch(() => {});
}

/**
 * An alert. `key` limits the rate (the same key: once per half hour);
 * `group`, when given, waits for its end (`resolve`).
 */
export function alert(kind: AlertKind, vars: Vars = {}, key: string = kind, group?: string): void {
  const t = text(kind, vars);
  console.warn(`[guard] ${t.title}: ${t.body.split("\n")[0]}`);
  if (group) raised.add(group);
  const now = Date.now();
  if ((last.get(key) ?? 0) > now - QUIET_MS) return;
  last.set(key, now);
  send(t);
}

/** End of an alert group in progress: announced once, then forgotten. */
export function resolve(group: string, kind: AlertKind, vars: Vars = {}): void {
  if (!raised.delete(group)) return;
  const t = text(kind, vars);
  console.warn(`[guard] ${t.title}: ${t.body}`);
  send(t);
}
