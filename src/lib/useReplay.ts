"use client";

import { useEffect, type RefObject } from "react";

/**
 * Rearms a section once it has fully left the screen.
 *
 * Every screen here is a toy, and a toy you can only wind up once is a dead
 * page on the second visit. Resetting on exit rather than on entry means the
 * reset is never visible — you always arrive at a fresh machine, and the one
 * you just finished stays finished for as long as you are looking at it.
 */
export function useReplay(
  ref: RefObject<HTMLElement | null>,
  reset: () => void,
  /** Held off while a timeline is mid-flight, so a reset cannot land inside it. */
  isBusy?: () => boolean
) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting && !isBusy?.()) reset();
        });
      },
      { threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, reset, isBusy]);
}
