"use client";

import { useCallback, useState } from "react";
import { Mascot } from "./Mascot";
import { useEntrance, prefersReducedMotion } from "@/lib/useEntrance";
import { useReplay } from "@/lib/useReplay";
import s from "./JoinSection.module.css";

/** The two live destinations. Both real, so both are plain external links. */
const X_URL = "https://x.com/cykablyatvip";
const TELEGRAM_URL = "https://t.me/cykablyatvip";

export function JoinSection() {
  const ref = useEntrance<HTMLElement>();
  const [run, setRun] = useState(0);

  // The hat tip, the gold and the buttons are CSS animations that fire on
  // mount, so replaying them means remounting: bumping this key is what lets
  // him greet you again instead of being frozen mid-welcome on every return.
  const rearm = useCallback(() => setRun((n) => n + 1), []);
  useReplay(ref, rearm);

  return (
    <section className="stage" ref={ref}>
      <div className="top" data-ent="fade" data-ent-delay="0">
        <div className="count">08 / 08</div>
      </div>

      <div className="head" data-ent="up" data-ent-delay="90">
        {/* Lower case in the markup, uppercase on screen — .sticker applies the
            transform, so writing it shouted here would only make the source
            harder to read. The accent is on the first "meme", the token itself;
            the memes powering it stay in the line's own colour. */}
        <h1 className="sticker">
          The <span className="hot">meme</span> powered by memes
        </h1>
      </div>

      <div className={`middle ${s.middle}`} data-ent="up" data-ent-delay="240">
        <div className={s.final} key={run}>
          <div className={s.hero}>
            <svg
              viewBox="0 0 200 40"
              style={{
                position: "absolute",
                inset: "auto 0 62% 0",
                overflow: "visible",
              }}
              aria-hidden="true"
            >
              <g className={s.spark} style={{ "--dx": "-52px", "--dy": "-46px" } as React.CSSProperties}>
                <circle cx="100" cy="20" r="9" fill="var(--cb)" stroke="var(--ink)" strokeWidth="3" />
              </g>
              <g className={s.spark} style={{ "--dx": "48px", "--dy": "-52px" } as React.CSSProperties}>
                <circle cx="100" cy="20" r="7" fill="var(--cb)" stroke="var(--ink)" strokeWidth="3" />
              </g>
              <g className={s.spark} style={{ "--dx": "-72px", "--dy": "-14px" } as React.CSSProperties}>
                <circle cx="100" cy="20" r="6" fill="var(--cb)" stroke="var(--ink)" strokeWidth="3" />
              </g>
              <g className={s.spark} style={{ "--dx": "70px", "--dy": "-8px" } as React.CSSProperties}>
                <circle cx="100" cy="20" r="8" fill="var(--cb)" stroke="var(--ink)" strokeWidth="3" />
              </g>
            </svg>

            <div className={s.tip}>
              <Mascot
                className={`grounded ${s.tipImg}`}
                alt="Capybara Blyatovich tipping his hat"
              />
            </div>
          </div>

          <div className={s.links}>
            <a
              className={s.link}
              href={X_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.9 2H22l-6.8 7.8L22.8 22h-6.4l-4.4-6.1L6.7 22H3.6l7.2-8.2 L3.2 2h6.5l4.1 5.7L18.9 2Zm-1.1 18h1.7L7.3 3.7H5.5L17.8 20Z" />
              </svg>
              Follow on X
            </a>

            <a
              className={s.link}
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M21.9 3.3 2.9 10.6c-1 .4-1 1.8 0 2.2l4.3 1.5 1.7 5.2c.3.9 1.4 1.1 2 .4l2.3-2.5 4.3 3.2c.7.5 1.7.1 1.9-.8l3.3-15 c.2-1-.8-1.8-1.8-1.5ZM9.4 14.7l-.4 3.7-1.2-3.8 8.9-6.2-7.3 6.3Z" />
              </svg>
              Join Telegram
            </a>
          </div>

          {/* No boxes, no cards: four lines with dotted leaders, the way a spec
              sheet reads. The two "None" rows are the ones people actually scan
              for, so they are given the same weight as the supply. */}
          <dl className={s.spec}>
            <div className={s.specRow}>
              <dt className={s.slab}>Total supply</dt>
              <span className={s.sdots} aria-hidden="true" />
              <dd className={s.sval}>1,000,000,000</dd>
            </div>
            <div className={s.specRow}>
              <dt className={s.slab}>Treasury</dt>
              <span className={s.sdots} aria-hidden="true" />
              <dd className={`${s.sval} ${s.hot}`}>
                50% <small>never sold</small>
              </dd>
            </div>
            <div className={s.specRow}>
              <dt className={s.slab}>Presale</dt>
              <span className={s.sdots} aria-hidden="true" />
              <dd className={s.sval}>None</dd>
            </div>
            <div className={s.specRow}>
              <dt className={s.slab}>Team allocation</dt>
              <span className={s.sdots} aria-hidden="true" />
              <dd className={s.sval}>None</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="bottom">
        <div className="hint" data-ent="up" data-ent-delay="430">&nbsp;</div>
        <button
          type="button"
          className={`cue ${s.toTop}`}
          data-ent="up"
          data-ent-delay="500"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: prefersReducedMotion() ? "auto" : "smooth",
            })
          }
        >
          <span>Back to top &uarr;</span>
        </button>
      </div>
    </section>
  );
}
