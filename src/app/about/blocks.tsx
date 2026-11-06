import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";

/** Building blocks shared by all languages of the About page. */

/** `icon`: kept in the content's signature, the section number replaces it on screen. */
export function Section({
  id,
  title,
  children,
}: {
  id: string;
  icon?: ComponentType<LucideProps>;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="sec">
      <h2 className="sec-title">{title}</h2>
      <div className="sec-body">{children}</div>
    </section>
  );
}

export function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group max-w-[72ch] border-b border-line">
      <summary className="cursor-pointer select-none py-3.5 font-medium text-ink transition-colors hover:text-accent-soft">
        {q}
      </summary>
      <div className="space-y-2 pb-4 text-[0.95rem] text-ink-dim">
        {children}
      </div>
    </details>
  );
}
