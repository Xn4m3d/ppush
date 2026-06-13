"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

const css = `
  .nf-star { position: fixed; width: 2px; height: 2px; border-radius: 50%; background: #9aa3b8;
    animation: nf-twinkle 3s ease-in-out infinite; pointer-events: none; }
  @keyframes nf-twinkle { 0%,100% { opacity: .15 } 50% { opacity: .8 } }
  .nf-title {
    font-size: clamp(90px, 18vw, 170px); font-weight: 800; letter-spacing: -6px; line-height: 1;
    background: linear-gradient(135deg, #9d92ff, #5b4ce0);
    -webkit-background-clip: text; background-clip: text; color: transparent;
    animation: nf-float 4s ease-in-out infinite; user-select: none;
  }
  @keyframes nf-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-14px) } }
  .nf-cat { position: relative; width: 170px; height: 140px; margin-top: -10px;
    animation: nf-float 4s ease-in-out infinite; animation-delay: .3s; }
  .nf-body { position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
    width: 120px; height: 75px; background: #1a1f2e;
    border: 3px solid #2d3650; border-bottom: none; border-radius: 60px 60px 0 0; }
  .nf-head { position: absolute; bottom: 52px; left: 50%; transform: translateX(-50%);
    width: 95px; height: 78px; background: #1a1f2e;
    border: 3px solid #2d3650; border-radius: 48% 48% 45% 45%; z-index: 2; }
  .nf-ear { position: absolute; top: -16px; width: 0; height: 0;
    border-left: 16px solid transparent; border-right: 16px solid transparent;
    border-bottom: 26px solid #2d3650; }
  .nf-ear::after { content: ''; position: absolute; left: -12px; top: 5px; width: 0; height: 0;
    border-left: 12px solid transparent; border-right: 12px solid transparent;
    border-bottom: 19px solid #1a1f2e; }
  .nf-ear.l { left: 6px; transform: rotate(-12deg); }
  .nf-ear.r { right: 6px; transform: rotate(12deg); }
  .nf-eye { position: absolute; top: 28px; width: 22px; height: 22px; background: #eef1f8;
    border-radius: 50%; overflow: hidden; }
  .nf-eye.l { left: 17px; } .nf-eye.r { right: 17px; }
  .nf-pupil { position: absolute; top: 50%; left: 50%; width: 10px; height: 10px;
    margin: -5px 0 0 -5px; background: #0b0d12; border-radius: 50%;
    transition: transform .08s linear; }
  .nf-eye.blink { animation: nf-blink .18s linear; }
  @keyframes nf-blink { 0%,100% { transform: scaleY(1) } 50% { transform: scaleY(.06) } }
  .nf-nose { position: absolute; top: 47px; left: 50%; transform: translateX(-50%);
    width: 9px; height: 6px; background: #9d92ff; border-radius: 40% 40% 60% 60%; }
  .nf-mouth { position: absolute; top: 53px; left: 50%; transform: translateX(-50%);
    width: 22px; height: 9px; border-bottom: 2.5px solid #5d6578; border-radius: 0 0 50% 50%; }
  .nf-whisker { position: absolute; width: 26px; height: 1.5px; background: #5d6578; top: 50px; }
  .nf-w1 { left: -22px; transform: rotate(8deg); } .nf-w2 { left: -22px; top: 57px; transform: rotate(-4deg); }
  .nf-w3 { right: -22px; transform: rotate(-8deg); } .nf-w4 { right: -22px; top: 57px; transform: rotate(4deg); }
  .nf-tail { position: absolute; bottom: 4px; right: -28px; width: 56px; height: 16px;
    border: 3px solid #2d3650; border-left: none; border-radius: 0 14px 14px 0;
    background: #1a1f2e; transform-origin: left center; animation: nf-wag 2.2s ease-in-out infinite; }
  @keyframes nf-wag { 0%,100% { transform: rotate(-12deg) } 50% { transform: rotate(22deg) } }
  .nf-paw { position: absolute; bottom: 0; width: 22px; height: 10px; background: #2d3650;
    border-radius: 8px 8px 0 0; }
  .nf-paw.l { left: 32px; } .nf-paw.r { right: 32px; }
  .nf-zzz { position: absolute; top: -8px; right: 8px; font-size: 15px; color: #5d6578;
    animation: nf-zz 3s ease-in-out infinite; opacity: 0; }
  .nf-zzz:nth-child(2) { animation-delay: 1s; }
  @keyframes nf-zz { 0% { opacity: 0; transform: translate(0,0) } 30% { opacity: .9 }
    100% { opacity: 0; transform: translate(14px,-22px) } }
`;

export default function NotFound() {
  const catRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cleanup: (() => void)[] = [];

    // stars
    const stars: HTMLSpanElement[] = [];
    for (let i = 0; i < 40; i++) {
      const s = document.createElement("span");
      s.className = "nf-star";
      s.style.left = Math.random() * 100 + "vw";
      s.style.top = Math.random() * 100 + "vh";
      s.style.animationDelay = Math.random() * 3 + "s";
      document.body.appendChild(s);
      stars.push(s);
    }
    cleanup.push(() => stars.forEach((s) => s.remove()));

    // pupils follow the cursor
    const onMove = (e: MouseEvent) => {
      const cat = catRef.current;
      if (!cat) return;
      const r = cat.getBoundingClientRect();
      const angle = Math.atan2(
        e.clientY - (r.top + r.height / 3),
        e.clientX - (r.left + r.width / 2)
      );
      const dx = Math.cos(angle) * 4.5;
      const dy = Math.sin(angle) * 4.5;
      cat.querySelectorAll<HTMLElement>(".nf-pupil").forEach((p) => {
        p.style.transform = `translate(${dx}px, ${dy}px)`;
      });
    };
    document.addEventListener("mousemove", onMove);
    cleanup.push(() => document.removeEventListener("mousemove", onMove));

    // blinks
    let timer: ReturnType<typeof setTimeout>;
    const blink = () => {
      const eyes = catRef.current?.querySelectorAll(".nf-eye") ?? [];
      eyes.forEach((e) => e.classList.add("blink"));
      setTimeout(() => eyes.forEach((e) => e.classList.remove("blink")), 200);
      timer = setTimeout(blink, 2500 + Math.random() * 4000);
    };
    timer = setTimeout(blink, 1500);
    cleanup.push(() => clearTimeout(timer));

    return () => cleanup.forEach((fn) => fn());
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-center">
      <style>{css}</style>
      <h1 className="nf-title">404</h1>

      <div className="nf-cat" ref={catRef}>
        <span className="nf-zzz">z</span>
        <span className="nf-zzz">Z</span>
        <div className="nf-tail" />
        <div className="nf-body" />
        <div className="nf-head">
          <div className="nf-ear l" />
          <div className="nf-ear r" />
          <div className="nf-eye l"><div className="nf-pupil" /></div>
          <div className="nf-eye r"><div className="nf-pupil" /></div>
          <div className="nf-nose" />
          <div className="nf-mouth" />
          <div className="nf-whisker nf-w1" />
          <div className="nf-whisker nf-w2" />
          <div className="nf-whisker nf-w3" />
          <div className="nf-whisker nf-w4" />
        </div>
        <div className="nf-paw l" />
        <div className="nf-paw r" />
      </div>

      <h2 className="mt-4 text-xl font-semibold sm:text-2xl">
        The cat searched everywhere.
      </h2>
      <p className="max-w-md text-sm text-ink-dim">
        This page doesn&apos;t exist, doesn&apos;t exist anymore, or never
        existed. He ended up sitting on it.
      </p>

      <Link
        href="/"
        className="mt-6 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-[0_4px_20px_-4px_rgba(124,108,255,0.45)] transition-all hover:bg-accent-soft"
      >
        Back to home
      </Link>

      <p className="mt-4 text-xs text-ink-faint">— error 404 · nothing to see here —</p>
    </main>
  );
}
