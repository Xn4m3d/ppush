import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import { MiniCloud } from "@/components/diffusion/mini-cloud";

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
      <span className="relative grid place-items-center">
        <MiniCloud seed={title.length} />
        <Icon className="absolute size-5 text-ink" />
      </span>
      <h1 className="text-3xl font-bold">{title}</h1>
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
