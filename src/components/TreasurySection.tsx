"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Vault, CbCoin } from "./Vault";
import { Capybara } from "./Borrowers";
import { useEntrance } from "@/lib/useEntrance";
import { useReplay } from "@/lib/useReplay";
import s from "./TreasurySection.module.css";

/**
 * Where the borrowed $CB actually comes from.
 *
 * One idea only: the treasury holds a fifth of the supply, it goes out against
 * locked memes, and it comes back when they are repaid. The coins run a
 * continuous loop between the safe and the borrowers because a loop is the
 * claim — money that circulates is money that is not being sold.
 */
export function TreasurySection() {
  const entRef = useEntrance<HTMLElement>();
  const stageRef = useRef<HTMLElement | null>(null);
  const flowRef = useRef<HTMLDivElement>(null);

  const [play, setPlay] = useState(false);

  const setRefs = useCallback(
    (el: HTMLElement | null) => {
      stageRef.current = el;
      entRef.current = el;
    },
    [entRef]
  );

  /**
   * The gap between the safe and the crowd changes a great deal between phone
   * and desktop, so the orbit is measured rather than tuned — otherwise the
   * coins land short of the borrowers on one and past them on the other.
   */
  const measure = useCallback(() => {
    const stage = stageRef.current;
    const flow = flowRef.current;
    if (!stage || !flow) return;
    const vault = flow.querySelector<SVGSVGElement>(`.${s.vault}`);
    const crowd = flow.querySelector<HTMLDivElement>(`.${s.crowd}`);
    if (!vault || !crowd) return;

    const f = flow.getBoundingClientRect();
    const v = vault.getBoundingClientRect();
    const c = crowd.getBoundingClientRect();

    const vx = v.left - f.left + v.width * 0.5;
    const vy = v.top - f.top + v.height * 0.55;
    const cx = c.left - f.left + c.width * 0.5;
    const cy = c.top - f.top + c.height * 0.45;

    flow.querySelectorAll<HTMLElement>(`.${s.gc}`).forEach((g) => {
      g.style.left = `${vx}px`;
      g.style.top = `${vy}px`;
    });
    stage.style.setProperty("--ox", `${cx - vx}px`);
    stage.style.setProperty("--oy", `${cy - vy}px`);
  }, []);

  useLayoutEffect(() => {
    measure();
    let t: number | undefined;
    const onResize = () => {
      window.clearTimeout(t);
      t = window.setTimeout(measure, 150);
    };
    window.addEventListener("resize", onResize);
    document.fonts?.ready.then(measure);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, [measure]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            measure();
            setPlay(true);
          }
        }),
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [measure]);

  const reset = useCallback(() => setPlay(false), []);
  useReplay(stageRef, reset);

  return (
    <section className={`stage ${s.stage} ${play ? s.play : ""}`} ref={setRefs}>
      <div className="top" data-ent="fade" data-ent-delay="0">
        <div className="count">05 / 09</div>
      </div>

      <div className="head" data-ent="up" data-ent-delay="90">
        <h1 className="sticker">
          Where the <span className="hot">$CB</span> comes from.
        </h1>
      </div>

      <div className={`middle ${s.middle}`} data-ent="up" data-ent-delay="240">
        <div className={s.tflow} ref={flowRef}>
          <div className={s.unit}>
            <div className={s.safewrap}>
              <Vault
                className={s.vault}
                alt="The treasury vault, holding 20% of all $CB"
                inside={
                  <>
                    <CbCoin cx={150} cy={330} r={26} />
                    <CbCoin cx={206} cy={330} r={26} />
                    <CbCoin cx={262} cy={330} r={26} />
                    <text
                      x="205"
                      y="215"
                      className={s.vpct}
                      textAnchor="middle"
                      aria-hidden="true"
                    >
                      20%
                    </text>
                  </>
                }
              />
            </div>
            <span className={`${s.cap} ${s.c1}`}>
              The treasury holds
              <br />
              <b>20% of all $CB</b>
            </span>
          </div>

          <div className={s.unit}>
            <div className={s.crowd}>
              <Capybara i={0} className={s.capy} />
              <Capybara i={1} className={s.capy} />
              <Capybara i={2} className={s.capy} />
            </div>
            <span className={`${s.cap} ${s.c2}`}>Out on loan</span>
          </div>

          {/* Three coins on one orbit, staggered a third of a lap apart, so the
              ring reads as continuous rather than as one coin going round. */}
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={s.gc}
              style={{ animationDelay: `${i * 1.4}s` }}
              aria-hidden="true"
            >
              <svg viewBox="-50 -50 100 100">
                <CbCoin r={45} />
              </svg>
            </span>
          ))}
        </div>

        <div className={s.stampline}>
          <span className={s.never}>
            Never sold on the market
            <small>Locked by the contract</small>
          </span>
        </div>
      </div>

      <div className="bottom">
        <div className={`hint ${s.say}`}>
          It only goes out against locked memes, and comes back when they are
          repaid.
        </div>
        <div className="cue">
          <span>Scroll ↓</span>
        </div>
      </div>
    </section>
  );
}
