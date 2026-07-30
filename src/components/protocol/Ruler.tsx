"use client";

import { useCallback, useRef } from "react";
import { LIQ_LTV, MAX_LTV, UI_MAX_LTV, healthOf, rulerPct } from "@/lib/health";
import s from "./Ruler.module.css";

/**
 * The loan-to-value ruler.
 *
 * The one rule that makes this screen readable: **every ruler is drawn on the
 * same 0→100 scale**, so the 80 cap and the 90 liquidation mark sit at the same
 * place on all of them — the borrow form and every row of the positions table
 * alike. That is what lets four loans be compared at a glance, and it is the
 * first thing lost in a rewrite: dividing by LIQ_LTV instead puts 80% at 89% of
 * the bar and every mark moves.
 *
 * The marks are placed from the constants in `health.ts`, never from percentages
 * typed into CSS, so a contract change moves them rather than silently making
 * them wrong.
 *
 * `interactive` turns it into a slider. Read-only rulers get no tab stop, no
 * hit area and no ARIA role — they are a picture of a number that is already on
 * screen beside them.
 */
export function Ruler({
  ltv,
  onChange,
  interactive = false,
  label,
  compact = false,
}: {
  ltv: number;
  onChange?: (next: number) => void;
  interactive?: boolean;
  label?: string;
  /** Drops the clearance an interactive track needs for its grab area. For
      read-only rulers stacked in a list, where that space is bought and never
      used. Never set this on an interactive one. */
  compact?: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const health = healthOf(ltv);

  const set = useCallback(
    (clientX: number) => {
      const r = track.current?.getBoundingClientRect();
      if (!r || !onChange) return;
      const raw = ((clientX - r.left) / r.width) * 100;
      // Hard stop at the UI's own maximum, which sits a hair under the
      // contract's 80 — see SAFETY_BPS. Dragging past it is not refused with an
      // error, it simply does not go further, which is what a physical stop
      // does and what makes the limit feel like a property of the control.
      onChange(Math.max(0, Math.min(UI_MAX_LTV, Math.round(raw))));
    },
    [onChange]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!onChange) return;
    const step = e.shiftKey ? 10 : 1;
    const map: Record<string, number> = {
      ArrowRight: ltv + step,
      ArrowUp: ltv + step,
      ArrowLeft: ltv - step,
      ArrowDown: ltv - step,
      Home: 0,
      End: UI_MAX_LTV,
    };
    if (!(e.key in map)) return;
    e.preventDefault();
    onChange(Math.max(0, Math.min(UI_MAX_LTV, map[e.key])));
  };

  const pct = rulerPct(ltv);

  return (
    <div className={`${s.wrap} ${compact && !interactive ? s.compact : ""}`}>
      <div
        ref={track}
        className={`${s.track} ${interactive ? s.live : ""}`}
        data-health={health}
        /* A slider that reports a value outside its own range is a slider that
           lies to a screen reader. valuemax is the reachable maximum, not the
           end of the drawing. */
        role={interactive ? "slider" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? (label ?? "Loan to value") : undefined}
        aria-valuemin={interactive ? 0 : undefined}
        aria-valuemax={interactive ? Math.round(UI_MAX_LTV) : undefined}
        aria-valuenow={interactive ? Math.round(ltv) : undefined}
        aria-valuetext={interactive ? `${Math.round(ltv)} percent` : undefined}
        onKeyDown={interactive ? onKeyDown : undefined}
        onPointerDown={
          interactive
            ? (e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                // Mouse only, as on the repay screen: with `touch-action: pan-y`
                // the browser has not yet decided whether a finger press is a
                // drag or a page scroll, and committing here would move the loan
                // for someone who was only trying to leave the screen.
                if (e.pointerType === "mouse") set(e.clientX);
              }
            : undefined
        }
        onPointerMove={
          interactive
            ? (e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) set(e.clientX);
              }
            : undefined
        }
      >
        <div className={s.fill} style={{ width: `${pct}%` }} />
        {/* Placed from the constants, so the contract owns where they sit. */}
        <div className={s.mark} style={{ left: `${MAX_LTV}%` }} data-kind="cap">
          <span>{MAX_LTV}</span>
        </div>
        <div className={s.mark} style={{ left: `${LIQ_LTV}%` }} data-kind="liq">
          <span>{LIQ_LTV}</span>
        </div>
        {interactive ? <div className={s.knob} style={{ left: `${pct}%` }} /> : null}
      </div>
    </div>
  );
}
