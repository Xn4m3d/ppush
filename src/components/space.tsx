"use client";

import { useEffect, useRef } from "react";
import { field } from "./diffusion/field";

/**
 * Space, behind the whole site: the site is a window set in front of it.
 * The canvas of the particle field (`diffusion/field.ts`): mounted once,
 * in the root layout, it survives navigations — the clouds of the send
 * and receive screens borrow their particles from it and give them back.
 */
export function Space() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => (ref.current ? field.mount(ref.current) : undefined), []);
  return <canvas ref={ref} className="space" aria-hidden />;
}
