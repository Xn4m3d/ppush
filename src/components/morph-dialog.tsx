"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";

// light spring: barely overshoots the target, then settles ("Apple" feel)
const SPRING = "cubic-bezier(0.32, 1.12, 0.42, 1)";
const EASE_IN = "cubic-bezier(0.55, 0, 0.75, 0.25)";
const OPEN_MS = 740;
const CLOSE_MS = 420;

/** Token colors read when the animation starts (current theme). */
function tokens() {
  const cs = getComputedStyle(document.documentElement);
  const acc = cs.getPropertyValue("--color-accent").trim() || "#ff7a59";
  const line = cs.getPropertyValue("--color-line").trim() || "#1b222e";
  const panel = cs.getPropertyValue("--color-panel-soft").trim() || "#141a24";
  return { acc, line, panel };
}

/**
 * Modal window that "grows out" of its button: on open, the window starts
 * from the button's exact shape and position, then stretches and slides
 * into place (FLIP + Web Animations). The content only appears once
 * the shape has nearly settled, so it is never seen distorted. Closing
 * (Escape, click outside, button) plays the path in reverse.
 *
 * Built on the native <dialog>: focus trap, Escape and top layer
 * with no dependency. `prefers-reduced-motion`: no morphing, no fading.
 */
export function MorphDialog({
  open,
  onClose,
  anchorRef,
  labelledBy,
  className = "",
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Element the window grows out of and returns into. */
  anchorRef: RefObject<HTMLElement | null>;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // button → window path, expressed as the transform to apply to the window
  const fromAnchor = () => {
    const d = ref.current, a = anchorRef.current;
    if (!d || !a) return null;
    const dr = d.getBoundingClientRect(), ar = a.getBoundingClientRect();
    if (!dr.width || !dr.height) return null;
    const sx = ar.width / dr.width, sy = ar.height / dr.height;
    const dx = ar.left - dr.left, dy = ar.top - dr.top;
    return `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
  };

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (open && !d.open) {
      closing.current = false;
      d.showModal();
      if (reduce) return;
      const from = fromAnchor();
      const { acc, line, panel } = tokens();
      if (from) {
        // the shape leaves the button, opaque and outlined in accent: it visibly
        // detaches, grows and slides into place
        d.animate(
          [
            { transform: from, borderRadius: "10px", borderColor: acc, backgroundColor: panel, boxShadow: `0 0 0 1px ${acc}, 0 0 32px -4px ${acc}` },
            { borderColor: acc, boxShadow: `0 0 0 1px ${acc}, 0 0 48px -10px ${acc}`, offset: 0.55 },
            { transform: "none", borderRadius: "18px", borderColor: line, boxShadow: "0 30px 80px -20px rgba(0,0,0,0.7)" },
          ],
          { duration: OPEN_MS, easing: SPRING }
        );
      }
      inner.current?.animate(
        [
          { opacity: 0, transform: "translateY(12px) scale(0.98)", filter: "blur(6px)" },
          { opacity: 0, transform: "translateY(12px) scale(0.98)", filter: "blur(6px)", offset: 0.45 },
          { opacity: 1, transform: "none", filter: "none" },
        ],
        { duration: OPEN_MS + 80, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
      );
      d.animate([{ opacity: 0 }, { opacity: 1 }], { duration: OPEN_MS, easing: "ease", pseudoElement: "::backdrop" });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Shrinks back into the button, then actually closes. */
  const close = () => {
    const d = ref.current;
    if (!d || closing.current) return;
    closing.current = true;
    const done = () => { d.close(); onCloseRef.current(); };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return done();
    const to = fromAnchor();
    const { acc, panel } = tokens();
    inner.current?.animate([{ opacity: 1, filter: "none" }, { opacity: 0, filter: "blur(6px)" }], { duration: 160, easing: "ease", fill: "forwards" });
    d.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CLOSE_MS, easing: "ease", pseudoElement: "::backdrop", fill: "forwards" });
    const anim = d.animate(
      [
        { transform: "none", borderRadius: "18px" },
        { borderColor: acc, backgroundColor: panel, offset: 0.4 },
        { transform: to ?? "scale(0.96)", borderRadius: "10px", borderColor: acc, backgroundColor: panel, opacity: 0.9 },
      ],
      { duration: CLOSE_MS, easing: EASE_IN, fill: "forwards" }
    );
    anim.onfinish = () => {
      done();
      d.getAnimations().forEach((a) => a.cancel());
      inner.current?.getAnimations().forEach((a) => a.cancel());
    };
  };

  useEffect(() => {
    if (!open && ref.current?.open && !closing.current) close();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      className={`morph-dialog m-auto max-h-[calc(100dvh-48px)] overflow-hidden rounded-[18px] border border-line bg-bg p-0 text-ink ${className}`}
      onCancel={(e) => { e.preventDefault(); close(); }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
      // Enter in a field: close without submitting the enclosing form
      onKeyDown={(e) => { if (e.key === "Enter" && e.target instanceof HTMLInputElement) { e.preventDefault(); close(); } }}
    >
      <div ref={inner} className="flex max-h-[calc(100dvh-50px)] flex-col">
        {children}
      </div>
      <CloseBridge onRequest={close} dialog={ref} />
    </dialog>
  );
}

/**
 * Lets inner buttons (close cross, "Done") trigger the animated
 * close: they dispatch `morph:close` on the dialog.
 */
function CloseBridge({ onRequest, dialog }: { onRequest: () => void; dialog: RefObject<HTMLDialogElement | null> }) {
  const cb = useRef(onRequest);
  useEffect(() => { cb.current = onRequest; });
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const fn = () => cb.current();
    d.addEventListener("morph:close", fn);
    return () => d.removeEventListener("morph:close", fn);
  }, [dialog]);
  return null;
}

/** Call from a button inside the window. */
export function requestMorphClose(el: HTMLElement | null) {
  el?.closest("dialog")?.dispatchEvent(new Event("morph:close"));
}
