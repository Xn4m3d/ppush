import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";

/** Building blocks shared by all languages of the About page. */

export function Section({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: ComponentType<LucideProps>;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
        <span className="grid size-9 place-items-center rounded-xl border border-accent/25 bg-accent/10">
          <Icon className="size-4.5 text-accent-soft" />
        </span>
        {title}
      </h2>
      <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-dim">
        {children}
      </div>
    </section>
  );
}

export function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-line bg-panel/60 transition-colors hover:border-line-soft">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-ink">
        {q}
      </summary>
      <div className="space-y-2 border-t border-line px-4 py-3 text-sm text-ink-dim">
        {children}
      </div>
    </details>
  );
}
