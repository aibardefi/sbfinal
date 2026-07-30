"use client";

import { useCallback, useRef } from "react";
import { LIQ_LTV, MAX_LTV, UI_MAX_LTV, riskOf, riskTone, rulerPct } from "@/lib/health";
import s from "./Ruler.module.css";

/**
 * The loan-to-value ruler, and on the borrow tab the control that sets it.
 *
 * The one rule that makes this screen readable: **every ruler is drawn on the
 * same 0→100 scale**, so the 80 cap and the 90 liquidation mark sit in the same
 * place on all of them — the borrow form and every row of the positions sheet
 * alike. That is what lets four loans be compared at a glance, and it is the
 * first thing lost in a rewrite: dividing by LIQ_LTV instead puts 80% at 89% of
 * the bar and every mark moves.
 *
 * The marks are placed from the constants in `health.ts`, never from percentages
 * typed into CSS, so a contract change moves them rather than silently making
 * them wrong.
 *
 * Colour comes from `riskOf`, which measures headroom to liquidation rather than
 * the ratio itself. Two tones, because a three-step ramp spends its middle step
 * saying "nothing is happening" exactly while the risk doubles.
 *
 * `interactive` turns it into a slider. Read-only rulers get no tab stop, no hit
 * area and no ARIA role — they are a picture of a number already on screen
 * beside them. `scale={false}` drops the legend for rulers in a list, where the
 * notches repeat on every row and the words would too.
 */
export function Ruler({
  ltv,
  onChange,
  interactive = false,
  label,
  scale = true,
}: {
  ltv: number;
  onChange?: (next: number) => void;
  interactive?: boolean;
  label?: string;
  scale?: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const tone = riskTone(riskOf(ltv));

  const set = useCallback(
    (clientX: number) => {
      const r = track.current?.getBoundingClientRect();
      if (!r || !onChange) return;
      const raw = ((clientX - r.left) / r.width) * 100;
      // Hard stop at the UI's own maximum, which sits a hair under the
      // contract's 80 — see SAFETY_BPS. Dragging past it is not refused with an
      // error, it simply does not go further, which is what a physical stop does
      // and what makes the limit feel like a property of the control.
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
    <div className={s.wrap}>
      <div
        ref={track}
        className={`${s.track} ${interactive ? s.drag : ""}`}
        data-tone={tone}
        style={{ ["--ltv" as string]: pct }}
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
        <div className={s.fill} />
        {/* Placed from the constants, so the contract owns where they sit. */}
        <div className={s.notch} style={{ left: `${MAX_LTV}%` }} />
        <div className={s.notch} style={{ left: `${LIQ_LTV}%` }} />
        {interactive ? <div className={s.knob} /> : null}
      </div>

      {scale ? (
        <div className={s.scale} aria-hidden="true">
          <span className={s.s0}>0</span>
          <span style={{ left: `${MAX_LTV}%` }}>{MAX_LTV} limit</span>
          <span style={{ left: `${LIQ_LTV}%` }}>{LIQ_LTV} liq</span>
        </div>
      ) : null}
    </div>
  );
}
