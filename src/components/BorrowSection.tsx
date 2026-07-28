"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { COINS } from "./coins";
import { Vault, CoinInVault, CbCoin } from "./Vault";
import { useEntrance } from "@/lib/useEntrance";
import { useReplay } from "@/lib/useReplay";
import s from "./BorrowSection.module.css";

/** The one whose coin makes the trip. Index into the shared roster. */
const TRAVELLER = 0; // CASHCAT

/**
 * The deal in one line of pictures: a meme goes in, $CB comes out, and the
 * meme is still yours.
 *
 * Left to right on purpose — that reading order *is* the explanation, which is
 * why the row is held on one line even on the narrowest phone in the spec
 * rather than wrapping to two.
 */
export function BorrowSection() {
  const entRef = useEntrance<HTMLElement>();
  const stageRef = useRef<HTMLElement | null>(null);
  const bagCoinRef = useRef<SVGSVGElement>(null);
  const flyerRef = useRef<HTMLDivElement>(null);

  const [play, setPlay] = useState(false);

  const setRefs = useCallback(
    (el: HTMLElement | null) => {
      stageRef.current = el;
      entRef.current = el;
    },
    [entRef]
  );

  /**
   * The travelling coin is placed from measured geometry rather than tuned
   * offsets, so it lands inside the safe at any width instead of only at the
   * one it was authored at.
   */
  const place = useCallback(() => {
    const stage = stageRef.current;
    const from = bagCoinRef.current;
    const flyer = flyerRef.current;
    // The locked coin is rendered by a shared helper, so it is found by class
    // rather than threaded a ref through someone else's component.
    const held = stage?.querySelector<SVGGElement>(`.${s.held}`);
    if (!stage || !from || !held || !flyer) return;

    // Measured against the flyer's own containing block, not the section.
    // `.middle` is position:relative, so it — not `.stage` — is what absolute
    // offsets resolve against; measuring from the section put the coin the
    // height of the headline too low and it landed under the safe.
    const host = flyer.offsetParent as HTMLElement | null;
    if (!host) return;
    const s0 = host.getBoundingClientRect();
    const a = from.getBoundingClientRect();
    const b = held.getBoundingClientRect();

    flyer.style.left = `${a.left - s0.left}px`;
    flyer.style.top = `${a.top - s0.top}px`;
    flyer.style.width = `${a.width}px`;
    flyer.style.height = `${a.width}px`;
    stage.style.setProperty("--dx", `${b.left + b.width / 2 - a.left - a.width / 2}px`);
    stage.style.setProperty("--dy", `${b.top + b.height / 2 - a.top - a.height / 2}px`);
  }, []);

  useLayoutEffect(() => {
    place();
    let t: number | undefined;
    const onResize = () => {
      window.clearTimeout(t);
      t = window.setTimeout(place, 150);
    };
    window.addEventListener("resize", onResize);
    // The measurement depends on the display face, so it has to be retaken once
    // the webfont swaps in — otherwise the arc is aimed using fallback metrics.
    document.fonts?.ready.then(place);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, [place]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            place();
            setPlay(true);
          }
        }),
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [place]);

  const reset = useCallback(() => setPlay(false), []);
  useReplay(stageRef, reset);

  const traveller = COINS[TRAVELLER];

  return (
    <section className={`stage ${s.stage} ${play ? s.play : ""}`} ref={setRefs}>
      <div className="top" data-ent="fade" data-ent-delay="0">
        <div className="count">02 / 09</div>
      </div>

      <div className="head" data-ent="up" data-ent-delay="90">
        <h1 className="sticker">
          Lock a <span className="hot">meme</span>. Borrow against it.
        </h1>
      </div>

      <div className={`middle ${s.middle}`} data-ent="up" data-ent-delay="240">
        <div className={s.flow}>
          <div className={s.unit}>
            <div className={s.bag}>
              {[TRAVELLER, 4, 3].map((i, n) => (
                <svg
                  key={COINS[i].ticker}
                  ref={n === 0 ? bagCoinRef : undefined}
                  className={`${s.disc} ${n > 0 ? s.small : ""}`}
                  viewBox="-50 -50 100 100"
                  aria-hidden={n > 0 ? true : undefined}
                  role={n === 0 ? "img" : undefined}
                  aria-label={n === 0 ? "a memecoin" : undefined}
                >
                  <circle r="45" fill={COINS[i].bg} stroke="var(--ink)" strokeWidth="8" />
                  <g
                    transform="scale(0.68) translate(-50 -50)"
                    fill={COINS[i].glyphOn}
                  >
                    {COINS[i].glyph}
                  </g>
                </svg>
              ))}
            </div>
            <span className={`${s.cap} ${s.c1}`}>
              You hold <b>$1,000</b>
              <br />
              of a memecoin
            </span>
          </div>

          <span className={s.arrow} aria-hidden="true">
            &rarr;
          </span>

          <div className={s.unit}>
            <div className={s.safewrap}>
              <Vault
                className={s.vault}
                alt="A glass vault holding your locked memecoin"
                inside={
                  <CoinInVault
                    coin={traveller}
                    cx={180}
                    cy={300}
                    r={34}
                    className={s.held}
                  />
                }
              />
            </div>
            <span className={`${s.cap} ${s.c2}`}>Lock it</span>
          </div>

          <span className={`${s.arrow} ${s.two}`} aria-hidden="true">
            &rarr;
          </span>

          <div className={s.unit}>
            <svg className={s.cbcoin} viewBox="-50 -50 100 100" aria-hidden="true">
              <CbCoin r={45} label="$800" />
            </svg>
            <span className={`${s.cap} ${s.c3}`}>
              Borrow <b>$800</b>
              <br />
              of $CB
            </span>
          </div>
        </div>

        {/* Rides above everything, positioned from the measurement above. */}
        <div className={s.flyer} ref={flyerRef} aria-hidden="true">
          <svg viewBox="-50 -50 100 100">
            <circle r="45" fill={traveller.bg} stroke="var(--ink)" strokeWidth="8" />
            <g transform="scale(0.68) translate(-50 -50)" fill={traveller.glyphOn}>
              {traveller.glyph}
            </g>
          </svg>
        </div>
      </div>

      <div className="bottom">
        <div className={`hint ${s.say}`}>
          Spend it however you like. <b>Repay it and your memecoin unlocks.</b>
        </div>
        <div className="cue">
          <span>Scroll ↓</span>
        </div>
      </div>
    </section>
  );
}
