"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mascot } from "./Mascot";
import { useEntrance, prefersReducedMotion } from "@/lib/useEntrance";
import { useReplay } from "@/lib/useReplay";
import s from "./JoinSection.module.css";

const CONTRACT: string | null = null;

/**
 * The real destinations. Kept together at the top so there is one place to
 * change when a link moves, and typed as string so the "#" placeholder branch
 * in handleLink still compiles for anything not yet live.
 */
const X_URL = "https://x.com/cykablyatvip";
const TELEGRAM_URL = "https://t.me/cykablyatvip";
/** The lending app. Same tab — it is ours, not somewhere off-site. */
const APP_URL = "https://app.cykablyat.vip";

function shorten(a: string) {
  return a.length > 20 ? a.slice(0, 8) + "…" + a.slice(-6) : a;
}

export function JoinSection() {
  const ref = useEntrance<HTMLElement>();
  const flashTimer = useRef<number | undefined>(undefined);

  /* Starts empty. The line exists to explain why a click did nothing — it has
     nothing to say until you click something. */
  const [signoff, setSignoff] = useState("");
  const [toastText, setToastText] = useState("Copied");
  const [showToast, setShowToast] = useState(false);
  const [run, setRun] = useState(0);

  // The hat tip, the gold and the three buttons are CSS animations that fire on
  // mount, so replaying them means remounting: bumping this key is what lets
  // him greet you again instead of being frozen mid-welcome on every return.
  const rearm = useCallback(() => {
    setRun((n) => n + 1);
    setSignoff("");
    setShowToast(false);
    window.clearTimeout(flashTimer.current);
  }, []);

  useReplay(ref, rearm);

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const ready = typeof CONTRACT === "string" && CONTRACT.length > 0;

  const flash = useCallback((msg: string) => {
    setToastText(msg);
    setShowToast(true);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setShowToast(false), 1600);
  }, []);

  /**
   * Last resort when the Clipboard API is missing or refused.
   *
   * navigator.clipboard is only defined in a secure context, so anyone opening
   * the site over plain http — or in an in-app browser that withholds it — got
   * "Press Ctrl+C" and no way to act on it, since the address is inside a
   * button and never selected. This puts the real string in a throwaway
   * textarea, selects it and copies, which is supported everywhere the modern
   * API is not.
   */
  const copyFallback = useCallback((text: string) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    // Off-screen rather than hidden: a display:none field cannot be selected,
    // and any on-screen position scrolls the page when it takes focus.
    ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }, []);

  const handleCopy = useCallback(() => {
    if (!ready) {
      flash("Not yet");
      setSignoff("The address lands at launch.");
      return;
    }
    const done = () => flash("Copied");
    const fallback = () => flash(copyFallback(CONTRACT!) ? "Copied" : "Copy failed");

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(CONTRACT!).then(done, fallback);
    } else {
      fallback();
    }
  }, [ready, flash, copyFallback]);

  const handleLink = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (e.currentTarget.getAttribute("href") === "#") {
        e.preventDefault();
        setSignoff("Give me the real link and this goes live.");
      }
    },
    []
  );

  return (
    <section className="stage" ref={ref}>
      <div className="top" data-ent="fade" data-ent-delay="0">
        <div className="count">09 / 09</div>
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
            <a className={`${s.link} ${s.primary}`} href={APP_URL} onClick={handleLink}>
              <svg
                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h13M12 5l7 7-7 7" />
              </svg>
              Launch app
            </a>

            <a
              className={s.link}
              href={X_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleLink}
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
              onClick={handleLink}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M21.9 3.3 2.9 10.6c-1 .4-1 1.8 0 2.2l4.3 1.5 1.7 5.2c.3.9 1.4 1.1 2 .4l2.3-2.5 4.3 3.2c.7.5 1.7.1 1.9-.8l3.3-15 c.2-1-.8-1.8-1.8-1.5ZM9.4 14.7l-.4 3.7-1.2-3.8 8.9-6.2-7.3 6.3Z" />
              </svg>
              Join Telegram
            </a>
          </div>

          <div className={s.ca}>
            <div className={s.caLabel}>Contract address</div>
            <div className={`${s.caWrap} ${showToast ? s.showCopied : ""}`}>
              <div className={s.copied}>{toastText}</div>
              <button
                className={`${s.caBox} ${ready ? s.caBoxReady : ""}`}
                type="button"
                onClick={handleCopy}
                aria-label={
                  ready
                    ? `Copy contract address ${CONTRACT}`
                    : "Contract address, not published yet"
                }
              >
                <span>{ready ? shorten(CONTRACT!) : "Coming soon"}</span>
                <svg
                  className={s.copy}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="9" y="9" width="12" height="12" rx="2.5" />
                  <path d="M15 5H5.5A1.5 1.5 0 0 0 4 6.5V16" />
                </svg>
              </button>
            </div>
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
                20% <small>never sold</small>
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

          <div className={s.signoff}>{signoff}</div>
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
