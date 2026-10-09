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

export function Story({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-dim">{children}</div>
    </section>
  );
}

export function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="rounded-xl border border-line bg-panel/60 p-4">
      <span className="font-mono text-xs text-accent-soft">0{n}</span>
      <p className="mt-1 font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm">{children}</p>
    </li>
  );
}

export function UseCase({ icon: Icon, title, children }: { icon: Icon; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-line bg-panel/60 p-4 transition-colors hover:border-line-soft">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-accent/25 bg-accent/10">
        <Icon className="size-4.5 text-accent-soft" />
      </span>
      <div>
        <p className="font-semibold text-ink">{title}</p>
        <p className="mt-1 text-sm">{children}</p>
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
