"use client";

import { useEffect, useRef } from "react";
import { cls } from "./ui";

/**
 * Home mascot: the 404 page's cat, whose pupils follow the cursor (and that
 * blinks). Purely decorative. Designed as a base to host other reactions
 * depending on the cursor position (to come).
 */
export function MascotCat({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cat = ref.current;
    if (!cat) return;

    // pupils follow the cursor
    const onMove = (e: MouseEvent) => {
      const r = cat.getBoundingClientRect();
      const angle = Math.atan2(
        e.clientY - (r.top + r.height / 3),
        e.clientX - (r.left + r.width / 2)
      );
      const dx = Math.cos(angle) * 4.5;
      const dy = Math.sin(angle) * 4.5;
      cat.querySelectorAll<HTMLElement>(".mc-pupil").forEach((p) => {
        p.style.transform = `translate(${dx}px, ${dy}px)`;
      });
    };
    document.addEventListener("mousemove", onMove);

    // spaced-out blinks
    let timer: ReturnType<typeof setTimeout>;
    const blink = () => {
      const eyes = cat.querySelectorAll(".mc-eye");
      eyes.forEach((el) => el.classList.add("mc-blink"));
      setTimeout(() => eyes.forEach((el) => el.classList.remove("mc-blink")), 200);
      timer = setTimeout(blink, 2500 + Math.random() * 4000);
    };
    timer = setTimeout(blink, 1500);

    return () => {
      document.removeEventListener("mousemove", onMove);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div ref={ref} className={cls("mc-cat", className)} aria-hidden>
      <div className="mc-tail" />
      <div className="mc-body" />
      <div className="mc-head">
        <div className="mc-ear l" />
        <div className="mc-ear r" />
        <div className="mc-eye l">
          <div className="mc-pupil" />
        </div>
        <div className="mc-eye r">
          <div className="mc-pupil" />
        </div>
        <div className="mc-nose" />
        <div className="mc-mouth" />
        <div className="mc-whisker mc-w1" />
        <div className="mc-whisker mc-w2" />
        <div className="mc-whisker mc-w3" />
        <div className="mc-whisker mc-w4" />
      </div>
      <div className="mc-paw l" />
      <div className="mc-paw r" />
    </div>
  );
}
