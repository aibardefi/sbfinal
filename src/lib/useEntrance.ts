"use client";

import { useEffect, useRef } from "react";

/**
 * Plays a section's entrance the first time it scrolls into view.
 *
 * Deliberately once-only: replaying every time you scroll past turns a piece
 * of choreography into a twitch. Elements are opted in with `data-ent`, so a
 * section decides what animates without this hook knowing its markup.
 *
 *   data-ent="fade"  — opacity only, for the top bar
 *   data-ent="up"    — rise and settle, for everything else
 *   data-ent-delay   — milliseconds, overriding the default stagger
 */
export function useEntrance<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targets = Array.from(
      root.querySelectorAll<HTMLElement>("[data-ent]")
    );
    if (!targets.length) return;

    if (reduced) {
      targets.forEach((el) => el.classList.remove("ent"));
      return;
    }

    targets.forEach((el) => el.classList.add("ent"));

    let done = false;
    const play = () => {
      if (done) return;
      done = true;
      targets.forEach((el, i) => {
        const delay = Number(el.dataset.entDelay ?? i * 130);
        window.setTimeout(() => {
          el.classList.remove("ent");
          el.classList.add(el.dataset.ent === "fade" ? "entGoFade" : "entGo");
        }, delay);
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            play();
            io.disconnect();
          }
        });
      },
      { threshold: 0.25 }
    );
    io.observe(root);

    return () => io.disconnect();
  }, []);

  return ref;
}

/** True when the visitor has asked for reduced motion. */
export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
