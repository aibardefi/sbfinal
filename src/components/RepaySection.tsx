"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MASCOT_HREF } from "./Mascot";
import { COINS } from "./coins";
import { useEntrance, prefersReducedMotion } from "@/lib/useEntrance";
import { useReplay } from "@/lib/useReplay";
import { useAutoRearm } from "@/lib/useAutoRearm";
import s from "./RepaySection.module.css";

const TOTAL = 42000;

/**
 * Where the locked memes sit inside the vault. Same shared roster as the other
 * screens — these are the very coins the machine swallowed one screen earlier,
 * so they cannot be a different five.
 */
const INSIDE_AT = [
  { x: 136, y: 182 },
  { x: 206, y: 172 },
  { x: 276, y: 182 },
  { x: 136, y: 292 },
  { x: 206, y: 302 },
  { x: 276, y: 292 },
];

export function RepaySection() {
  const ref = useEntrance<HTMLElement>();
  const sliderRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const insideRef = useRef<SVGGElement>(null);
  const doorLRef = useRef<SVGGElement>(null);
  const bubbleTimer = useRef<number | undefined>(undefined);
  const releaseTimers = useRef<number[]>([]);
  const dragging = useRef(false);

  const [p, setP] = useState(0);
  const [freed, setFreed] = useState(false);
  const [snap, setSnap] = useState(false);
  const [nope, setNope] = useState(false);
  const [hint, setHint] = useState("Drag the handle right to repay");

  const say = useCallback((text: string) => {
    const el = bubbleRef.current;
    if (!el) return;
    el.textContent = text;
    el.classList.add("show");
    window.clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(
      () => el.classList.remove("show"),
      2000
    );
  }, []);

  const free = useCallback(() => {
    setFreed(true);
    setHint("Unlocked. They are yours again.");
    say("we are square.");

    // The door itself is driven by `freed` through an inline transform, so all
    // that is left here is what happens after it has swung: the memes climb out
    // one at a time, in the order they went in.
    if (prefersReducedMotion()) {
      insideRef.current?.querySelectorAll(`.${s.memeOut}`).forEach((m) => {
        (m as SVGGElement).style.opacity = "0";
      });
      return;
    }

    insideRef.current?.querySelectorAll(`.${s.memeOut}`).forEach((m, i) => {
      releaseTimers.current.push(
        window.setTimeout(() => {
          (m as SVGGElement).animate(
            [
              { transform: "translate(0,0) scale(1)", opacity: 1 },
              // Out through the opening first, then up and away — going
              // straight up would take them through the door frame.
              { transform: "translate(70px,-30px) scale(1.1)", opacity: 1, offset: 0.4 },
              { transform: "translate(150px,-210px) scale(0.55)", opacity: 0 },
            ],
            { duration: 1200, easing: "cubic-bezier(.4,0,.6,1)", fill: "forwards" }
          );
        }, 820 + i * 150)
      );
    });
  }, [say]);

  const commit = useCallback(
    (v: number) => {
      const next = Math.max(0, Math.min(1, v));
      setP(next);
      if (next >= 1 && !freed) free();
      return next;
    },
    [free, freed]
  );

  const travel = () => {
    const w = sliderRef.current?.clientWidth ?? 0;
    const k = knobRef.current?.offsetWidth ?? 0;
    return Math.max(1, w - k);
  };

  const pointerP = (clientX: number) => {
    const r = sliderRef.current?.getBoundingClientRect();
    if (!r) return 0;
    const k = knobRef.current?.offsetWidth ?? 0;
    return (clientX - r.left - k / 2) / travel();
  };

  const release = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    if (freed) return;

    // Short of the end: springs back, and he tells you so.
    setSnap(true);
    setP((was) => {
      if (was > 0.06) {
        setNope(true);
        window.setTimeout(() => setNope(false), 300);
        say(was > 0.75 ? "so close." : "not enough.");
        setHint("All of it, or nothing comes out.");
      }
      return 0;
    });
  }, [freed, say]);

  useEffect(() => {
    if (freed) return;
    setHint((h) =>
      h === "All of it, or nothing comes out."
        ? h
        : p === 0
          ? "Drag the handle right to repay"
          : p < 0.35
            ? `${Math.round(p * 100)}% repaid — the lock is lifting`
            : p < 0.8
              ? `${Math.round(p * 100)}% repaid — keep going`
              : p < 1
                ? `${Math.round(p * 100)}% — almost off`
                : "Paid in full."
    );
  }, [p, freed]);

  useEffect(
    () => () => {
      window.clearTimeout(bubbleTimer.current);
      releaseTimers.current.forEach(clearTimeout);
    },
    []
  );

  // Cancelling the door and meme animations is what actually rebuilds the
  // vault — the state alone would leave it standing open and empty.
  const rearm = useCallback(() => {
    releaseTimers.current.forEach(clearTimeout);
    releaseTimers.current = [];
    window.clearTimeout(bubbleTimer.current);
    insideRef.current?.querySelectorAll(`.${s.memeOut}`).forEach((m) => {
      const el = m as SVGGElement;
      el.getAnimations().forEach((a) => a.cancel());
      el.style.opacity = "";
    });
    bubbleRef.current?.classList.remove("show");
    setFreed(false);
    setSnap(false);
    setP(0);
    setHint("Drag the handle right to repay");
  }, []);

  useReplay(ref, rearm, () => dragging.current);
  // The safe re-locks itself once the freed memes have been admired, putting the
  // handle back at zero for another go.
  useAutoRearm(freed, rearm, 5200);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (freed) return;
    const step = e.shiftKey ? 0.25 : 0.08;
    const keys: Record<string, number> = {
      ArrowRight: p + step,
      ArrowUp: p + step,
      ArrowLeft: p - step,
      ArrowDown: p - step,
      End: 1,
      Home: 0,
    };
    if (!(e.key in keys)) return;
    e.preventDefault();
    setSnap(true);
    commit(keys[e.key]);
  };

  const x = p * travel();
  const owed = Math.round(TOTAL * (1 - p));

  return (
    <section className={`stage ${freed ? s.freed : ""}`} ref={ref}>
      <div className="top" data-ent="fade" data-ent-delay="0">
        <div className="eyebrow">Capybara Blyatovich · Lending Co.</div>
        <div className="count">03 / 07</div>
      </div>

      <div className="head" data-ent="up" data-ent-delay="90">
        <h1 className="sticker">
          Repay <span className="hot">$SB</span>. Take them back.
        </h1>
      </div>

      <div className={`middle ${s.middle}`} data-ent="up" data-ent-delay="240">
        <div className={s.readout}>
          <div className={s.label}>Left to repay</div>
          <div className={s.value}>{owed.toLocaleString("en-US")}</div>
        </div>

        <div className={s.wrap}>
          <div className={`bubble ${s.bubble}`} ref={bubbleRef}>
            all of it.
          </div>

          <svg
            className={`${s.svg} ${nope ? s.nope : ""}`}
            viewBox="0 0 620 520"
            role="img"
            aria-label="A vault holding your locked memecoins"
          >
            <g stroke="var(--ink)" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round">
              {/* The same glass safe as the machine screen, one screen later.
                  Walls transparent, hardware brass — and here the drag drives
                  the hardware in reverse: dial back, bolts out, door open. */}
              <rect
                x="50"
                y="70"
                width="420"
                height="356"
                rx="22"
                fill="var(--glass)"
                fillOpacity="0.07"
              />
              <path
                d="M50 400 L222 70 L288 70 L116 426 L50 426 Z"
                fill="#ffffff"
                fillOpacity="0.5"
                stroke="none"
              />
              <rect
                x="50"
                y="70"
                width="420"
                height="356"
                rx="22"
                fill="none"
                stroke="var(--glass-lit)"
                strokeOpacity="0.75"
                strokeWidth="4"
              />
              <rect
                x="88"
                y="108"
                width="344"
                height="280"
                rx="14"
                fill="var(--glass-deep)"
                fillOpacity="0.07"
              />
              <rect
                x="88"
                y="108"
                width="344"
                height="280"
                rx="14"
                fill="none"
                stroke="var(--glass-lit)"
                strokeOpacity="0.5"
                strokeWidth="3"
              />

              <g ref={insideRef}>
                {/* Outer group holds the place in the vault, inner one flies.
                    On one element the animation replaced the attribute and every
                    meme took off from the top-left corner instead of from where
                    it was sitting. */}
                {COINS.map((coin, i) => (
                  <g
                    key={coin.ticker}
                    transform={`translate(${INSIDE_AT[i].x} ${INSIDE_AT[i].y})`}
                  >
                    <g className={s.memeOut}>
                      <circle r="30" fill={coin.bg} stroke="var(--ink)" strokeWidth="6" />
                      <g transform="scale(0.46) translate(-50 -50)" fill={coin.glyphOn}>
                        {coin.glyph}
                      </g>
                    </g>
                  </g>
                ))}
              </g>

              {/* The door, hinged right. Shut at rest; it swings clear of the
                  memes only once the last bolt is out. */}
              <g
                ref={doorLRef}
                className={s.safeDoor}
                style={{ transform: freed ? "scaleX(0)" : "scaleX(1)" }}
              >
                <rect
                  x="88"
                  y="108"
                  width="344"
                  height="280"
                  rx="14"
                  fill="var(--glass)"
                  fillOpacity="0.16"
                />
                <path
                  d="M110 372 L196 122 L232 122 L146 372 Z"
                  fill="#ffffff"
                  fillOpacity="0.4"
                  stroke="none"
                />
              </g>

              {/* Four throw bolts, one per quarter of the repayment. Each pulls
                  back into the door as its own quarter is paid, so the drag has
                  four things to show you instead of one number going down. */}
              {[150, 208, 266, 324].map((y, i) => {
                const local = Math.max(0, Math.min(1, (p - i * 0.25) / 0.25));
                return (
                  <rect
                    key={y}
                    x="72"
                    y={y}
                    width="30"
                    height="18"
                    rx="6"
                    fill="var(--gold)"
                    strokeWidth="5"
                    style={{
                      transform: `translateX(${(local * 28).toFixed(1)}px)`,
                      transition: "transform 120ms linear",
                    }}
                  />
                );
              })}

              <g fill="var(--gold)" strokeWidth="5">
                <rect x="422" y="132" width="22" height="34" rx="9" />
                <rect x="422" y="231" width="22" height="34" rx="9" />
                <rect x="422" y="330" width="22" height="34" rx="9" />
              </g>

              <rect x="90" y="426" width="72" height="26" rx="10" fill="var(--ink)" />
              <rect x="358" y="426" width="72" height="26" rx="10" fill="var(--ink)" />
            </g>

            {/* Dial and handle: solid brass over the glass, and the only parts
                that answer the drag directly. */}
            <g
              className={s.rdial}
              stroke="var(--ink)"
              strokeWidth="6"
              style={{ transform: `rotate(${(-p * 720).toFixed(1)}deg)` }}
            >
              <circle cx="362" cy="186" r="38" fill="var(--gold)" />
              <circle cx="362" cy="186" r="21" fill="var(--gold-deep)" />
              <path d="M362 186 L362 155" strokeWidth="7" />
            </g>
            <g stroke="var(--ink)" strokeWidth="4" strokeLinecap="round">
              <path d="M362 140 v9 M362 223 v9 M316 186 h9 M399 186 h9" />
            </g>

            <g
              className={s.rhandle}
              stroke="var(--ink)"
              strokeWidth="5"
              style={{ transform: freed ? "rotate(-120deg)" : "rotate(0deg)" }}
            >
              <circle cx="362" cy="306" r="30" fill="none" />
              <path
                d="M362 306 V276 M362 306 L388 321 M362 306 L336 321"
                stroke="var(--gold)"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <circle cx="362" cy="306" r="11" fill="var(--gold)" />
            </g>

            <image
              className="breathe grounded"
              href={MASCOT_HREF}
              x="440"
              y="222"
              width="184"
              height="234"
              preserveAspectRatio="xMidYMax meet"
            />
          </svg>
        </div>
      </div>

      <div className="bottom">
        <div className="hint">{hint}</div>

        <div
          ref={sliderRef}
          className={`${s.slider} ${freed ? s.done : ""}`}
          tabIndex={0}
          role="slider"
          aria-label="Repay $SB"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(p * 100)}
          onKeyDown={onKeyDown}
          /* One set of handlers on the whole slider, with the capture taken
             here rather than on the knob. Previously a press on the track set
             the dragging flag but left the move handler on the knob, so the
             only draggable thing was the 62px knob itself — and a stray
             timeout released that drag after 460ms regardless, which is what
             made it feel like the handle kept slipping out of your hand. */
          onPointerDown={(e) => {
            if (freed) return;
            // Deliberately no preventDefault: cancelling pointerdown leaves
            // activeElement on <body>, so this slider never took focus by being
            // used and its arrow-key handler was unreachable without tabbing.
            e.currentTarget.focus();
            dragging.current = true;
            setSnap(false);
            e.currentTarget.setPointerCapture(e.pointerId);
            commit(pointerP(e.clientX));
          }}
          onPointerMove={(e) => {
            if (!dragging.current || freed) return;
            commit(pointerP(e.clientX));
          }}
          onPointerUp={release}
          onPointerCancel={release}
        >
          <div className={s.track}>
            <div className={s.fill} style={{ width: `${(p * 100).toFixed(2)}%` }} />
          </div>
          <div
            ref={knobRef}
            className={`${s.knob} ${snap ? s.snap : ""}`}
            style={{ left: `${x}px` }}
          >
            <svg viewBox="0 0 100 100" fill="var(--ink)" aria-hidden="true">
              <path d="M38 22 L66 50 L38 78 Z" />
              <rect x="20" y="44" width="14" height="12" rx="3" />
            </svg>
          </div>
        </div>

        <div className="cue">
          <span>Scroll ↓</span>
        </div>
      </div>
    </section>
  );
}
