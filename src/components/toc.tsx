"use client";

import { useEffect, useState } from "react";

type Item = { id: string; title: string };

/**
 * Contents of the reading pages, read from the page itself: each `.sec` of the
 * body (id on the section or on its title, title `.sec-title`). The section
 * being read is marked on scroll.
 */
export function Toc({ label }: { label: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [current, setCurrent] = useState("");

  useEffect(() => {
    const secs = [...document.querySelectorAll<HTMLElement>(".doc-body .sec")];
    const list = secs
      .map((s) => ({
        el: s,
        id: s.id || s.querySelector<HTMLElement>("[id]")?.id || "",
        title: s.querySelector(".sec-title")?.textContent?.trim() ?? "",
      }))
      .filter((s) => s.id && s.title);
    // reading the DOM after render: state is set outside the effect's body
    const raf = requestAnimationFrame(() => setItems(list.map(({ id, title }) => ({ id, title }))));
    // the section being read: the last one whose top has passed the upper third of the screen
    const io = new IntersectionObserver(
      () => {
        const line = window.innerHeight / 3;
        let cur = list[0]?.id ?? "";
        for (const s of list) if (s.el.getBoundingClientRect().top <= line) cur = s.id;
        setCurrent(cur);
      },
      { rootMargin: "0px 0px -60% 0px", threshold: [0, 1] }
    );
    list.forEach((s) => io.observe(s.el));
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, []);

  if (!items.length) return null;
  return (
    <nav aria-label={label}>
      <p className="eyebrow">{label}</p>
      <ol>
        {items.map((it, i) => (
          <li key={it.id}>
            <a href={`#${it.id}`} aria-current={current === it.id ? "true" : undefined}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              {it.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
