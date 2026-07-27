"use client";

import { useEffect } from "react";

/**
 * Winds a finished screen back up while you are still looking at it.
 *
 * `useReplay` only resets a section once it has scrolled away, which leaves a
 * screen you finished sitting spent for as long as you stay on it — the clock
 * awake, the cards face up, the safe hanging open, with nothing left to touch.
 * The machine screen already returns by itself after MORE MEMES, and this is
 * that behaviour made available to the rest of them.
 *
 * The timer keys off the settled flag, so any interaction that unsettles the
 * screen cancels the pending reset rather than racing it, and unmounting clears
 * it. Reduced motion is deliberately not special-cased: the reset is a state
 * change, not an animation, and someone who has asked for less movement still
 * wants a screen they can use twice.
 */
export function useAutoRearm(
  /** True once the screen has reached its end state and is just sitting there. */
  settled: boolean,
  rearm: () => void,
  /** Long enough to read the payoff line before the screen offers itself again. */
  delay = 4200
) {
  useEffect(() => {
    if (!settled) return;
    const t = window.setTimeout(rearm, delay);
    return () => window.clearTimeout(t);
  }, [settled, rearm, delay]);
}
