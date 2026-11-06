import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import { PageHead } from "./page-head";

/** Common layout for the legal pages (/legal, /privacy). */

/** The page head; `icon` stays in the signature, the eyebrow replaces it on screen. */
export function LegalHeader({
  eyebrow,
  title,
  updated,
}: {
  eyebrow: string;
  icon?: ComponentType<LucideProps>;
  title: string;
  updated: string;
}) {
  return <PageHead eyebrow={eyebrow} title={title} meta={updated} />;
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
    <section id={id} className="sec">
      <h2 className="sec-title">{title}</h2>
      <div className="sec-body">{children}</div>
    </section>
  );
}
