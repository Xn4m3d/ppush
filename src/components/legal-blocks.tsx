import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";

/** Common layout for the legal pages (/legal, /privacy). */

export function LegalHeader({
  icon: Icon,
  title,
  updated,
}: {
  icon: ComponentType<LucideProps>;
  title: string;
  updated: string;
}) {
  return (
    <header className="flex flex-col items-center gap-3 text-center">
      <span className="grid size-12 place-items-center rounded-2xl border border-accent/25 bg-accent/10">
        <Icon className="size-6 text-accent-soft" />
      </span>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="text-xs text-ink-faint">{updated}</p>
    </header>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h2 className="border-b border-line pb-2 text-lg font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-ink-dim">
        {children}
      </div>
    </section>
  );
}
