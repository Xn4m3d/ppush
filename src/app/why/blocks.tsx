import type { ComponentType, ReactNode } from "react";
import {
  Briefcase,
  FileText,
  Headset,
  House,
  Hourglass,
  Route,
  ScanEye,
  Users,
  Wifi,
  type LucideProps,
} from "lucide-react";

/** Building blocks shared by every language of "What is this site for?". */

type Icon = ComponentType<LucideProps>;

export const USE_CASE_ICONS = {
  wifi: Wifi,
  work: Briefcase,
  home: House,
  family: Users,
  file: FileText,
  support: Headset,
} satisfies Record<string, Icon>;

export const HABIT_ICONS = {
  once: ScanEye,
  split: Route,
  short: Hourglass,
} satisfies Record<string, Icon>;

/** Readable anchor taken from the title (contents, deep links). */
function slug(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function Story({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section id={slug(title)} className="sec">
      <h2 className="sec-title">{title}</h2>
      <div className="sec-body">{children}</div>
    </section>
  );
}

export function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="step">
      <span className="font-mono text-xs text-accent-soft">0{n}</span>
      <p className="mt-1 text-lg font-semibold text-ink">{title}</p>
      <p className="mt-1 text-[0.95rem]">{children}</p>
    </li>
  );
}

export function UseCase({ icon: Icon, title, children }: { icon: Icon; title: string; children: ReactNode }) {
  return (
    <div className="case">
      <span className="case-ic">
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0">
        <p className="font-semibold text-ink">{title}</p>
        <p className="mt-1 text-[0.95rem]">{children}</p>
      </div>
    </div>
  );
}

export function Habit({ icon: Icon, title, children }: { icon: Icon; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-accent-soft" />
      <div>
        <p className="font-semibold text-ink">{title}</p>
        <p className="mt-1 text-sm">{children}</p>
      </div>
    </div>
  );
}
