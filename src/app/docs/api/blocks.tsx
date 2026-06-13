import type { ReactNode } from "react";
import { CopyButton } from "@/components/copy-button";

/** Building blocks shared by all languages of the API docs. */

export function Code({ children, copy }: { children: string; copy?: boolean }) {
  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-xl border border-line bg-bg-soft p-4 text-[13px] leading-relaxed text-ink-dim">
        <code>{children}</code>
      </pre>
      {copy && (
        <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100">
          <CopyButton value={children} label="" />
        </div>
      )}
    </div>
  );
}

export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 border-b border-line pb-2 text-xl font-semibold tracking-tight">
      {children}
    </h2>
  );
}

export function Endpoint({
  method,
  path,
  auth,
  children,
}: {
  method: string;
  path: string;
  auth: string;
  children: ReactNode;
}) {
  const colors: Record<string, string> = {
    GET: "text-ok border-ok/30 bg-ok/10",
    POST: "text-accent-soft border-accent/30 bg-accent/10",
    PUT: "text-warn border-warn/30 bg-warn/10",
    DELETE: "text-danger border-danger/30 bg-danger/10",
  };
  return (
    <div className="rounded-2xl border border-line bg-panel/60 p-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className={`rounded-lg border px-2 py-0.5 font-mono text-xs font-bold ${colors[method]}`}>
          {method}
        </span>
        <code className="font-mono text-sm text-ink">{path}</code>
        <span className="ml-auto text-xs text-ink-faint">{auth}</span>
      </div>
      <div className="mt-3 space-y-3 text-sm text-ink-dim">{children}</div>
    </div>
  );
}
