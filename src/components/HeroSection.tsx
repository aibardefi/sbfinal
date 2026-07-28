"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Mascot } from "./Mascot";
import { COINS, CoinGlyph, type Coin } from "./coins";
import { useEntrance, prefersReducedMotion } from "@/lib/useEntrance";
import { useAutoRearm } from "@/lib/useAutoRearm";
import s from "./HeroSection.module.css";

const MAX = 10;
const PER = 4200; // $CB borrowed per coin

/**
 * Where the two calls to action point. Buy is still a placeholder until the
 * pool is live — `handleCta` catches "#" so a visitor gets told rather than
 * being bounced to the top of the page. Borrow now goes to the lending app,
 * in the same tab: it is a move between two of our own properties, not a link
 * off-site.
 */
const BUY_URL = "#";
const BORROW_URL = "https://app.cykablyat.vip";

/** What he says, and when. Deadpan escalation. */
const LINES: Record<number, string> = {
  1: "fine.",
  3: "that's it?",
  5: "more.",
  7: "i am rich now",
  10: "full. stop.",
};

export function HeroSection() {
  const ref = useEntrance<HTMLElement>();
  const mascotRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const bubbleTimer = useRef<number | undefined>(undefined);

  const [fed, setFed] = useState(0);
  /* Counted when a coin is launched, not when it lands. `fed` only catches up
     620ms later, so guarding on it let rapid taps put more than MAX coins in
     the air — the surplus re-fired the "full. stop." line and skipped the
     lines in between. */
  const inFlight = useRef(0);

  /** Width outruns height — that is what makes him read as fat, not zoomed. */
  const shape = (n: number) => {
    const sy = 1 + n * 0.032;
    return { sx: sy * (1 + n * 0.038), sy };
  };

  useEffect(() => () => window.clearTimeout(bubbleTimer.current), []);

  const say = useCallback((text: string) => {
    const el = bubbleRef.current;
    if (!el) return;
    el.textContent = text;
    el.classList.add("show");
    window.clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(
      () => el.classList.remove("show"),
      2200
    );
  }, []);

  const gulp = useCallback((n: number) => {
    const el = mascotRef.current;
    if (!el || prefersReducedMotion()) return;
    const { sx, sy } = shape(n);
    const k = (x: number, y: number) => `scale(${sx * x},${sy * y})`;
    // Squash on impact, overshoot on the rebound, then a smaller wobble that
    // settles after the main move. That trailing beat is follow-through, and
    // it is most of the difference between "it scaled" and "something landed".
    el.animate(
      [
        { transform: k(1, 1), offset: 0 },
        { transform: k(1.09, 0.88), offset: 0.16 },
        { transform: k(0.95, 1.07), offset: 0.42 },
        { transform: k(1.03, 0.975), offset: 0.66 },
        { transform: k(0.99, 1.012), offset: 0.85 },
        { transform: k(1, 1), offset: 1 },
      ],
      { duration: 720, easing: "cubic-bezier(.25,.7,.35,1)" }
    );
  }, []);

  const fly = useCallback((coin: Coin, from: DOMRect, done: () => void) => {
    if (prefersReducedMotion() || !mascotRef.current) {
      done();
      return;
    }
    const box = mascotRef.current.getBoundingClientRect();
    const tx = box.left + box.width / 2;
    const ty = box.top + box.height * 0.52; // his mouth
    const dx = tx - (from.left + from.width / 2);
    const dy = ty - (from.top + from.height / 2);

    const outer = document.createElement("div");
    outer.className = s.flyer;
    Object.assign(outer.style, {
      left: `${from.left}px`,
      top: `${from.top}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
      background: coin.bg,
    });
    const inner = document.createElement("div");
    Object.assign(inner.style, {
      width: "100%",
      height: "100%",
      display: "grid",
      placeItems: "center",
    });
    outer.appendChild(inner);
    document.body.appendChild(outer);

    const root = createRoot(inner);
    root.render(<CoinGlyph coin={coin} />);

    const DUR = 620;
    const rise = Math.max(70, Math.abs(dy) * 0.42);

    // Split the axes. A thrown object moves horizontally at a near-constant
    // rate while gravity accelerates it downward; one shared curve on both
    // axes is exactly what makes an arc read as a tween instead of a throw.
    outer.animate(
      [{ transform: "translateX(0)" }, { transform: `translateX(${dx}px)` }],
      { duration: DUR, easing: "cubic-bezier(.36,.15,.62,.9)", fill: "forwards" }
    );
    inner.animate(
      [
        { transform: "translateY(0) rotate(0deg) scale(1)", offset: 0 },
        {
          transform: `translateY(${dy - rise}px) rotate(210deg) scale(1.12)`,
          offset: 0.42,
        },
        { transform: `translateY(${dy}px) rotate(400deg) scale(0.14)`, offset: 1 },
      ],
      { duration: DUR, easing: "cubic-bezier(.3,.7,.5,1)", fill: "forwards" }
    );

    const fade = outer.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: DUR,
    });
    fade.onfinish = () => {
      root.unmount();
      outer.remove();
      done();
    };
  }, []);

  const feed = (coin: Coin, e: React.MouseEvent<HTMLButtonElement>) => {
    if (inFlight.current >= MAX) return;
    const rect = (
      e.currentTarget.querySelector(`.disc`) as HTMLElement
    )?.getBoundingClientRect();
    if (!rect) return;

    inFlight.current += 1;
    fly(coin, rect, () => {
      // Side effects out of the updater: React may run one more than once.
      const next = Math.min(MAX, inFlight.current);
      setFed(next);
      gulp(next);
      if (LINES[next]) say(LINES[next]);
    });
  };

  /** A placeholder link should say so, not silently jump to the top. */
  const handleCta = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (e.currentTarget.getAttribute("href") === "#") {
        e.preventDefault();
        say("soon.");
      }
    },
    [say]
  );

  const { sx, sy } = shape(fed);
  const full = fed >= MAX;

  // Hands the bags back on his own once he is full, so the coins are tappable
  // again without scrolling away first. Same restore the button performs, minus
  // the "no." — that line is a reply to being asked, and nobody asked.
  const deflate = useCallback(() => {
    inFlight.current = 0;
    setFed(0);
  }, []);
  useAutoRearm(full, deflate, 5200);

  return (
    <section className="stage" ref={ref}>
      <div className="top" data-ent="fade" data-ent-delay="0">
        <div className="count">01 / 09</div>
        {/* The two things a visitor can actually do, on the one screen everyone
            sees. Orange buys, blue borrows — the same two colours the headline
            already uses for those two words. */}
        <div className={s.topcta}>
          <a className={`${s.cta} ${s.buy}`} href={BUY_URL} onClick={handleCta}>
            Buy $CB
          </a>
          <a
            className={`${s.cta} ${s.borrow}`}
            href={BORROW_URL}
            onClick={handleCta}
          >
            Borrow $CB
          </a>
        </div>
      </div>

      <div className="head" data-ent="up" data-ent-delay="90">
        <h1 className="sticker">
          Lock <span className="hot">memes</span>. Borrow the{" "}
          <span className="hot">meme</span>.
        </h1>
      </div>

      <div className={`middle ${s.middle}`} data-ent="up" data-ent-delay="240">
        <div className={s.readout}>
          <div className={s.label}>$CB borrowed</div>
          <div className={s.value}>{(fed * PER).toLocaleString("en-US")}</div>
        </div>

        <div className={`bubble ${s.bubble}`} ref={bubbleRef}>
          fine.
        </div>

        <div
          ref={mascotRef}
          className={s.mascot}
          style={{ transform: `scale(${sx.toFixed(3)},${sy.toFixed(3)})` }}
        >
          {/* Breathing sits on the image, not the wrapper: the wrapper already
              carries the fed-scale and the gulp, and one element cannot hold
              two competing transforms. */}
          <Mascot
            className="breathe"
            priority
            alt="Capybara Blyatovich, who eats your memecoins"
          />
        </div>
      </div>

      <div className="bottom">
        <div className="hint" data-ent="up" data-ent-delay="430">
          {full
            ? "Full. That is a lot of $CB."
            : fed === 0
              ? "Feed him your bags — tap a coin"
              : `${fed} of ${MAX} bags locked`}
        </div>

        <div className={s.rail} data-ent="up" data-ent-delay="500">
          {COINS.map((coin) => (
            <button
              key={coin.ticker}
              className="sbtn"
              disabled={full}
              onClick={(e) => feed(coin, e)}
              aria-label={`Feed him ${coin.ticker}`}
            >
              <span
              className="disc"
              style={{ "--disc-bg": coin.bg } as React.CSSProperties}
            >
                <CoinGlyph coin={coin} />
              </span>
              <span className="slabel">{coin.ticker}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className={`${s.reset} ${fed > 0 ? s.show : ""}`}
          onClick={() => {
            inFlight.current = 0;
            setFed(0);
            say("no.");
          }}
        >
          Give the bags back
        </button>

        <div className="cue" data-ent="up" data-ent-delay="570">
          <span>Scroll ↓</span>
        </div>
      </div>
    </section>
  );
}
