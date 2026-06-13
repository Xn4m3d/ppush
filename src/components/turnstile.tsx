"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

type RenderOpts = {
  sitekey: string;
  callback: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
  theme?: "light" | "dark" | "auto";
};
type TurnstileAPI = {
  render: (el: HTMLElement, opts: RenderOpts) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileAPI;
  }
}

const SCRIPT_ID = "cf-turnstile-api";
const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export type TurnstileHandle = { reset: () => void };

/** Cloudflare Turnstile widget. Reports the token via onToken (""=none/expired). */
export const Turnstile = forwardRef<
  TurnstileHandle,
  { siteKey: string; onToken: (token: string) => void }
>(function Turnstile({ siteKey, onToken }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
    },
  }));

  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | undefined;

    function render() {
      if (cancelled || !container.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(container.current, {
        sitekey: siteKey,
        callback: (t) => onToken(t),
        "error-callback": () => onToken(""),
        "expired-callback": () => onToken(""),
        theme: "auto",
      });
    }

    if (window.turnstile) {
      render();
    } else if (!document.getElementById(SCRIPT_ID)) {
      const s = document.createElement("script");
      s.id = SCRIPT_ID;
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.onload = render;
      document.head.appendChild(s);
    } else {
      poll = setInterval(() => {
        if (window.turnstile) {
          clearInterval(poll);
          render();
        }
      }, 150);
    }

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  return <div ref={container} className="flex min-h-[65px] justify-center" />;
});
