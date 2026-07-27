"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MASCOT_HREF } from "./Mascot";
import { COINS, COIN_COLOR, CoinGlyph } from "./coins";
import { useEntrance, prefersReducedMotion } from "@/lib/useEntrance";
import { useAutoRearm } from "@/lib/useAutoRearm";
import s from "./VaultSection.module.css";

const TOTAL = 42000;
const SVGNS = "http://www.w3.org/2000/svg";

/**
 * Where each waiting memecoin sits above the hopper. The coins themselves come
 * from the shared roster, so this screen and the feeding screen can never drift
 * apart on which tokens exist.
 */
/** Centre of the funnel's narrow neck, and the waiting coins' radius. */
const FUNNEL_NECK_X = 330;
const FEED_COIN_R = 19;

/**
 * Three to a side, arcing down at the outer edges, with a 74-unit hole in the
 * middle. The hole is the point: IN used to be squeezed into whatever space was
 * left between a continuous row of coins and the hopper rim, which was none —
 * it touched the coin above it and sat on the rim below. The coins now frame
 * the word instead of closing over it, and they hang wider than the funnel
 * mouth so the gap can be big enough to read into.
 */
const FEED_AT = [
  { x: 171, y: 30 },
  { x: 213, y: 16 },
  { x: 255, y: 6 },
  { x: 367, y: 6 },
  { x: 409, y: 16 },
  { x: 451, y: 30 },
];

/**
 * Where each meme comes to rest inside the safe.
 *
 * Two rows of three in the left two-thirds of the door, because the right third
 * is now occupied by the dial and the handle — hardware that has to stay clear
 * of the coins or the door reads as a pile of overlapping circles.
 */
const INSIDE_AT = [
  { x: 216, y: 234 },
  { x: 268, y: 224 },
  { x: 320, y: 234 },
  { x: 216, y: 302 },
  { x: 268, y: 310 },
  { x: 320, y: 302 },
];

const SPEND_LINE: Record<string, string> = {
  lambo: "gone.",
  pizza: "worth it.",
  memes: "again? fine.",
};

export function VaultSection() {
  const ref = useEntrance<HTMLElement>();
  const stageRef = useRef<HTMLElement | null>(null);
  const payoutRef = useRef<SVGGElement>(null);
  const feedRef = useRef<SVGGElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const rollRaf = useRef<number | null>(null);
  const busy = useRef(false);

  const [pulled, setPulled] = useState(false);
  const [borrowed, setBorrowed] = useState(0);
  const [hint, setHint] = useState("");
  const [spendOpen, setSpendOpen] = useState(false);
  const [spent, setSpent] = useState(false);
  const [jolt, setJolt] = useState(false);
  /** How many memes have made it into the vault. Drives the chamber filling. */
  const [landed, setLanded] = useState(0);

  const setRefs = useCallback(
    (el: HTMLElement | null) => {
      stageRef.current = el;
      ref.current = el;
    },
    [ref]
  );

  const after = useCallback((ms: number, fn: () => void) => {
    timers.current.push(
      window.setTimeout(fn, prefersReducedMotion() ? 0 : ms)
    );
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    // The counter runs on rAF, not a timeout, so it survived this and would
    // drive a freshly-zeroed readout straight back up to the full amount.
    if (rollRaf.current !== null) {
      cancelAnimationFrame(rollRaf.current);
      rollRaf.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const say = useCallback((text: string) => {
    const el = bubbleRef.current;
    if (!el) return;
    el.textContent = text;
    el.classList.add("show");
  }, []);

  const dropCoins = useCallback(() => {
    const coins = feedRef.current?.querySelectorAll(`.${s.drop}`);
    coins?.forEach((c, i) => {
      after(195 + i * 100, () => {
        const el = c as SVGGElement;
        if (prefersReducedMotion()) {
          el.style.opacity = "0";
          setLanded((n) => Math.max(n, i + 1));
          return;
        }
        // Funnel mouth spans 212..448 but its neck is only 288..372, so a coin
        // that falls straight down from where it waits passes through the
        // sloped wall instead of into the hole. Each one slides in along the
        // wall to the neck: barely any drift while it is still above the mouth,
        // then most of it during the run down the slope.
        //
        // These offsets are relative, which only works because this element
        // carries no position of its own — its parent holds the translate. Put
        // both on one element and the animation replaces the attribute, which
        // is what used to fling every coin over to the lever and drop it there.
        // The whole journey, in one animation: across to the funnel neck, down
        // through it, into the safe, and onto the exact spot it will sit. It
        // used to fade out at the neck and a second copy popped into existence
        // inside, so you never actually saw a meme enter the safe — which is
        // the one thing this screen is meant to explain.
        const sx = FEED_AT[i].x + FEED_COIN_R;
        const sy = FEED_AT[i].y + FEED_COIN_R;
        const neckDx = FUNNEL_NECK_X - sx;
        const neckDy = 172 - sy;
        const restDx = INSIDE_AT[i].x - sx;
        const restDy = INSIDE_AT[i].y - sy;
        const f = (n: number) => n.toFixed(1);

        const fall = el.animate(
          [
            { transform: "translate(0,0) scale(1)" },
            // Most of the sideways drift happens while it is still above the
            // mouth; a coin that falls straight down hits the sloped wall.
            { transform: `translate(${f(neckDx * 0.55)}px,${f(neckDy * 0.42)}px)`, offset: 0.28 },
            // Through the throat, narrow enough to squeeze.
            { transform: `translate(${f(neckDx)}px,${f(neckDy)}px) scale(0.84)`, offset: 0.5 },
            { transform: `translate(${f(restDx)}px,${f(restDy - 30)}px) scale(0.95)`, offset: 0.8 },
            { transform: `translate(${f(restDx)}px,${f(restDy)}px) scaleY(0.8) scaleX(1.14)`, offset: 0.9 },
            { transform: `translate(${f(restDx)}px,${f(restDy)}px) scale(1)` },
          ],
          { duration: 700, easing: "cubic-bezier(.4,0,.55,1)", fill: "forwards" }
        );
        // Hand off to the resting copy at the same coordinates, so the swap is
        // invisible and the coin simply stays where it landed.
        fall.onfinish = () => {
          el.style.opacity = "0";
          setLanded((n) => Math.max(n, i + 1));
        };
      });
    });
  }, [after]);

  /** Gold spraying out of the chute and piling in two tiers on the floor. */
  const payOut = useCallback(() => {
    for (let i = 0; i < 12; i++) {
      after(2800 + i * 72, () => {
        const host = payoutRef.current;
        if (!host) return;

        const g = document.createElementNS(SVGNS, "g");
        const c = document.createElementNS(SVGNS, "circle");
        c.setAttribute("r", "17");
        // Literal, not var(--gold): setAttribute writes a plain attribute value,
        // and an attribute cannot resolve a custom property. These three are the
        // only hard-coded colours left outside the coin roster.
        c.setAttribute("fill", "#d9a020");
        c.setAttribute("stroke", "#12110c");
        c.setAttribute("stroke-width", "5");
        const t = document.createElementNS(SVGNS, "text");
        t.setAttribute("text-anchor", "middle");
        t.setAttribute("y", "4.5");
        t.setAttribute("font-size", "12");
        t.setAttribute("font-weight", "900");
        t.setAttribute("letter-spacing", "-0.4");
        t.setAttribute("fill", "#12110c");
        t.textContent = "$SB";
        g.append(c, t);

        // Two tiers, tightened and dropped clear of the feet. Wider spacing put
        // the heap up over the machine's own legs, so the payout read as coins
        // strewn across the cabinet rather than as a pile on the floor.
        const tier = i % 2;
        const lane = Math.floor(i / 2) - 2.5;
        const lx = 330 + lane * 38 + tier * 19;
        const ly = 528 - tier * 24;
        g.setAttribute("transform", `translate(330 400)`);
        // Where it ends up. The payout animation is fill:forwards, so the
        // attribute still reads the chute position — spending needs the real
        // resting place to lift from, not the corner of the viewBox.
        g.dataset.lx = String(lx);
        g.dataset.ly = String(ly);
        host.appendChild(g);

        if (prefersReducedMotion()) {
          g.setAttribute("transform", `translate(${lx} ${ly})`);
          return;
        }
        g.animate(
          [
            { transform: "translate(330px,400px) rotate(0deg)" },
            {
              transform: `translate(${330 + lane * 14}px,${ly - 90}px) rotate(${lane * 60}deg)`,
              offset: 0.45,
            },
            // Lands near-upright. Spinning them to a random resting angle was
            // fine when the face was a blank disc, but now it carries a ticker
            // and a coin lying on its side cannot be read.
            { transform: `translate(${lx}px,${ly}px) rotate(${lane * 5}deg)` },
          ],
          { duration: 910, easing: "cubic-bezier(.3,.7,.4,1)", fill: "forwards" }
        );
      });
    }
  }, [after]);

  const rollCounter = useCallback(() => {
    if (prefersReducedMotion()) {
      setBorrowed(TOTAL);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 1430);
      setBorrowed(Math.round(TOTAL * (1 - Math.pow(1 - p, 3))));
      rollRaf.current = p < 1 ? requestAnimationFrame(step) : null;
    };
    rollRaf.current = requestAnimationFrame(step);
  }, []);

  const reset = useCallback(
    (silent: boolean) => {
      clearTimers();
      setPulled(false);
      setJolt(false);
      setBorrowed(0);
      setSpendOpen(false);
      setSpent(false);
      setLanded(0);
      if (payoutRef.current) payoutRef.current.innerHTML = "";
      bubbleRef.current?.classList.remove("show");
      // Only the fall. getAnimations() also hands back the CSS bob, and
      // cancelling a CSSAnimation through the API detaches it permanently —
      // the coins stopped bobbing for good after one scroll-away.
      feedRef.current?.querySelectorAll(`.${s.drop}`).forEach((c) => {
        const el = c as SVGGElement;
        el.getAnimations().forEach((a) => a.cancel());
        el.style.opacity = "";
      });
      if (!silent) {
        // Blank, not "Pull the lever": that instruction now sits above the
        // lever itself, and repeating it down here read as two separate
        // prompts for one control.
        setHint("");
        busy.current = false;
      }
    },
    [clearTimers]
  );

  const startSequence = useCallback(() => {
    dropCoins();

    // The jolt lands with the padlock, not the door — that's the heavy beat.
    after(2360, () => {
      if (prefersReducedMotion()) return;
      setJolt(true);
      after(416, () => setJolt(false));
    });

    payOut();
    after(2800, rollCounter);

    after(3600, () => say("buy whatever you want."));

    after(4250, () => {
      setSpendOpen(true);
      setHint("Now go spend it.");
      busy.current = false;
    });
  }, [after, dropCoins, payOut, rollCounter, say]);

  const pull = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    reset(true);
    setHint("");

    // Across two commits, not one. React batches a false-then-true inside a
    // single handler into no DOM change at all, so every `.pulled` rule stayed
    // parked in its end state: from the second pull onward the door never
    // re-closed, the padlock never dropped, the machine never shuddered and the
    // chute never lit. Only the lever moved, because only the lever had been
    // given a key to force it. Letting the class genuinely go off and back on
    // restarts all of them, and needs no keys at all.
    requestAnimationFrame(() => {
      setPulled(true);
      startSequence();
    });
  }, [reset, startSequence]);

  const spendOn = useCallback(
    (kind: string) => {
      if (!spendOpen || spent) return;
      const coins = payoutRef.current?.querySelectorAll("g");
      if (!coins?.length) return;
      setSpent(true);

      coins.forEach((g, i) => {
        after(i * 35, () => {
          if (prefersReducedMotion()) {
            g.remove();
            return;
          }
          // Absolute viewBox coordinates, not a relative rise: written as
          // translate(0,-260) every coin converged on the top-left corner and
          // the whole pile slewed left as it faded.
          const cx = Number(g.dataset.lx ?? 330);
          const cy = Number(g.dataset.ly ?? 400);
          g.animate(
            [
              { transform: `translate(${cx}px,${cy}px)`, opacity: 1 },
              { transform: `translate(${cx}px,${cy - 260}px) scale(0.2)`, opacity: 0 },
            ],
            { duration: 520, easing: "cubic-bezier(.5,0,.9,.4)", fill: "forwards" }
          ).onfinish = () => g.remove();
        });
      });

      after(600, () => {
        say(SPEND_LINE[kind]);
        setHint(kind === "memes" ? "And now you owe him." : "That was fast.");
        // MORE MEMES is the joke and the hand-off into the next screen.
        if (kind === "memes") after(1400, () => reset(false));
      });
    },
    [reset, say, spendOpen, spent]
  );

  // Once the gold has been spent the screen has nothing left to offer, so it
  // rebuilds itself. MORE MEMES already resets at 1400ms and cancels this by
  // clearing `spent`; this is what covers LAMBO and PIZZA, which used to leave
  // the machine standing empty for good.
  const rebuild = useCallback(() => reset(false), [reset]);
  useAutoRearm(spent, rebuild, 4600);

  // Rearm when the section scrolls away, so coming back gives a fresh machine.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting && !busy.current) reset(false);
        });
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reset]);

  const idle = !pulled;

  return (
    <section
      // spendOpen is set in the same beat that releases `busy`, so it marks
      // exactly the moment the lever becomes pullable again — which is when its
      // label has to come back.
      className={`stage ${pulled ? s.pulled : ""} ${jolt ? s.jolt : ""} ${
        spendOpen ? s.settled : ""
      }`}
      ref={setRefs}
    >
      <div className="top" data-ent="fade" data-ent-delay="0">
        <div className="count">02 / 07</div>
      </div>

      <div className="head" data-ent="up" data-ent-delay="90">
        <h1 className="sticker">
          Lock them. Borrow <span className="hot">$SB</span>.
        </h1>
      </div>

      <div className={`middle ${s.middle}`} data-ent="up" data-ent-delay="240">
        <div className={s.readout}>
          <div className={s.label}>$SB borrowed</div>
          <div className={s.value}>{borrowed.toLocaleString("en-US")}</div>
        </div>

        <div className={s.wrap}>
          <div className={`bubble ${s.bubble}`} ref={bubbleRef}>
            buy whatever you want.
          </div>

          <svg
            className={s.svg}
            viewBox="0 0 660 560"
            role="img"
            aria-label="A machine that locks memecoins and pays out $SB"
          >
            <g ref={feedRef}>
              {/* Three layers, one job each: the outer group holds the coin's
                  place above the hopper, the middle one falls, the inner one
                  bobs. Stacking any two of those on one element means the
                  animation replaces the position outright. */}
              {COINS.map((coin, i) => (
                <g
                  key={coin.ticker}
                  transform={`translate(${FEED_AT[i].x} ${FEED_AT[i].y})`}
                >
                  <g className={s.drop}>
                    <g
                      className={`${s.feedcoin} ${idle ? s.bob : ""}`}
                      style={{ animationDelay: `${-0.4 * i}s` }}
                    >
                      <circle r="19" cx="19" cy="19" fill={coin.bg} stroke="var(--ink)" strokeWidth="4" />
                      <g transform="translate(19 19) scale(0.3) translate(-50 -50)" fill={coin.glyphOn}>
                        {coin.glyph}
                      </g>
                    </g>
                  </g>
                </g>
              ))}
            </g>

            <g
              className={s.shell}
              stroke="var(--ink)"
              strokeWidth="7"
              strokeLinejoin="round"
              strokeLinecap="round"
            >
              {/* inlet */}
              <path d="M212 86 L448 86 L372 158 L288 158 Z" fill="var(--funnel)" />
              <rect x="206" y="78" width="248" height="16" rx="7" fill="var(--funnel-dark)" />

              {/* The carcass: a safe with glass walls. Everything structural is
                  transparent and everything mechanical is brass, which is what
                  keeps it readable as a safe rather than as a glass box. */}
              <rect
                x="150"
                y="152"
                width="360"
                height="300"
                rx="20"
                fill="var(--glass)"
                fillOpacity="0.07"
              />
              {/* A single raking highlight across the whole carcass. Flat tint
                  alone reads as frosted plastic — what says "glass" is a hard
                  specular streak and a bright edge, not more colour. */}
              <path
                d="M150 400 L296 152 L360 152 L214 452 L150 452 Z"
                fill="#ffffff"
                fillOpacity="0.5"
                stroke="none"
              />
              <rect
                x="150"
                y="152"
                width="360"
                height="300"
                rx="20"
                fill="none"
                stroke="var(--glass-lit)"
                strokeOpacity="0.75"
                strokeWidth="4"
              />
              {/* The cavity behind the door. Without it the carcass was one flat
                  wash of colour and read as a solid plastic slab rather than as
                  a box you can see into. */}
              <rect
                x="186"
                y="186"
                width="252"
                height="176"
                rx="12"
                fill="var(--glass-deep)"
                fillOpacity="0.07"
              />
              <rect
                x="186"
                y="186"
                width="252"
                height="176"
                rx="12"
                fill="none"
                stroke="var(--glass-lit)"
                strokeOpacity="0.5"
                strokeWidth="3"
              />

              {/* Inside, behind the door. Each appears as its falling twin
                  arrives, so the safe fills a coin at a time. */}
              {COINS.map((coin, i) => (
                <g
                  key={coin.ticker}
                  transform={`translate(${INSIDE_AT[i].x} ${INSIDE_AT[i].y})`}
                >
                  <g className={`${s.inside} ${landed > i ? s.insideIn : ""}`}>
                    <circle r="21" fill={coin.bg} stroke="var(--ink)" strokeWidth="4" />
                    <g transform="scale(0.33) translate(-50 -50)" fill={coin.glyphOn}>
                      {coin.glyph}
                    </g>
                  </g>
                </g>
              ))}

              {/* The door. Hinged on the right, so it sweeps shut across the
                  memes from the hinge side — the same direction a real one
                  would. */}
              <g className={s.door}>
                <rect
                  x="186"
                  y="186"
                  width="252"
                  height="176"
                  rx="12"
                  fill="var(--glass)"
                  fillOpacity="0.16"
                />
                <path
                  d="M204 350 L262 198 L292 198 L234 350 Z"
                  fill="#ffffff"
                  fillOpacity="0.4"
                  stroke="none"
                />
              </g>

              {/* Dial and handle sit above the door so they stay solid while it
                  moves — brass on a glass door is the whole idea. */}
              <g className={s.dial}>
                <circle cx="392" cy="236" r="34" fill="var(--gold)" />
                <circle cx="392" cy="236" r="19" fill="var(--gold-deep)" />
                <path d="M392 236 L392 208" strokeWidth="7" />
              </g>
              <g stroke="var(--ink)" strokeWidth="4" strokeLinecap="round">
                <path d="M392 194 v8 M392 270 v8 M350 236 h8 M426 236 h8" />
              </g>

              <g className={s.handle}>
                <circle cx="392" cy="318" r="26" fill="none" strokeWidth="5" />
                <path
                  d="M392 318 V292 M392 318 L414 331 M392 318 L370 331"
                  stroke="var(--gold)"
                  strokeWidth="9"
                  strokeLinecap="round"
                />
                <circle cx="392" cy="318" r="10" fill="var(--gold)" strokeWidth="5" />
              </g>

              {/* Four throw bolts. They live inside the door and shoot left into
                  the frame one after another — this is the lock, made visible. */}
              <g>
                {[210, 252, 294, 336].map((y, i) => (
                  <rect
                    key={y}
                    className={s.bolt}
                    style={{ "--i": i } as React.CSSProperties}
                    x="168"
                    y={y}
                    width="30"
                    height="16"
                    rx="5"
                    fill="var(--gold)"
                    strokeWidth="5"
                  />
                ))}
              </g>

              {/* Barrel hinges on the hanging edge. */}
              <g fill="var(--gold)" strokeWidth="5">
                <rect x="428" y="200" width="22" height="30" rx="9" />
                <rect x="428" y="259" width="22" height="30" rx="9" />
                <rect x="428" y="318" width="22" height="30" rx="9" />
              </g>

              <rect
                className={s.chuteGlow}
                x="236"
                y="380"
                width="188"
                height="30"
                rx="9"
                fill="var(--gold)"
                stroke="none"
              />
              <rect x="236" y="380" width="188" height="30" rx="9" fill="none" />

              <rect x="176" y="452" width="58" height="34" rx="12" fill="var(--ink)" />
              <rect x="426" y="452" width="58" height="34" rx="12" fill="var(--ink)" />
            </g>

            {/* The only red on the page, so the thing you touch is the thing
                that shouts. */}
            <g
              className={s.lever}
              onClick={pull}
              role="button"
              tabIndex={0}
              aria-label="Pull the lever"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  pull();
                }
              }}
            >
              <rect
                x="128"
                y="236"
                width="26"
                height="26"
                rx="6"
                fill="var(--machine-dark)"
                stroke="var(--ink)"
                strokeWidth="6"
              />
              <g className={s.leverArm}>
                <rect
                  x="133"
                  y="150"
                  width="15"
                  height="100"
                  rx="7"
                  fill="var(--machine-dark)"
                  stroke="var(--ink)"
                  strokeWidth="6"
                />
                <circle
                  className={`${s.leverKnob} ${idle ? s.glint : ""}`}
                  cx="141"
                  cy="146"
                  r="27"
                  fill="var(--stamp)"
                  stroke="var(--ink)"
                  strokeWidth="7"
                />
              </g>

            </g>

            {/* Deliberately a sibling of the lever, not a child: it nudges on a
                loop, and inside the button that motion would keep the click
                target's box moving. Without it the red knob was just a red dot
                — nothing said it was the control. */}
            {/* Two lines, not one: set on a single line at a readable size the
                label reached the hopper rim and sat under the first coin. */}
            <text
              className={s.pullLabel}
              x="141"
              y="76"
              textAnchor="middle"
              fontWeight="900"
              fontSize="19"
              letterSpacing="0.5"
              fill="var(--stamp)"
              aria-hidden="true"
            >
              <tspan x="141">Pull the</tspan>
              <tspan x="141" dy="21">lever</tspan>
            </text>

            {/* IN / LOCKED / OUT on the three parts is the whole explanation. */}
            <g
              fontWeight="900"
              fontSize="19"
              letterSpacing="2"
              fill="var(--text-dim)"
              textAnchor="middle"
            >
              {/* Up into the gap the coins now leave, and bigger than the two
                  labels on the machine body — it sits on open background rather
                  than on a slab, so it has nothing behind it to lift it off the
                  page. Baseline 40 puts its lowest ink ~32 units clear of the
                  rim it used to rest on. */}
              <text x="330" y="42" fontSize="26" letterSpacing="3" fill="var(--ink)">
                IN
              </text>
              <text className={s.labelLocked} x="330" y="178" fill="var(--ink)">
                LOCKED
              </text>
              <text className={s.labelOut} x="330" y="437" fill="var(--ink)">
                OUT
              </text>
            </g>

            <g ref={payoutRef} />

            {/* Slide-in on the group, breathing on the image inside it —
                one element cannot carry both transforms. */}
            <g className={s.mascot}>
              <image
                className={s.mascotBreath}
                href={MASCOT_HREF}
                x="452"
                y="250"
                width="200"
                height="254"
                preserveAspectRatio="xMidYMax meet"
              />
            </g>
          </svg>
        </div>
      </div>

      <div className="bottom">
        <div className="hint">{hint}</div>

        <div className={`${s.spend} ${spendOpen ? s.spendShow : ""}`}>
          <button
            className={s.spendBtn}
            disabled={spent}
            onClick={() => spendOn("lambo")}
            aria-label="Spend it on a lambo"
          >
            <span className={s.spendDisc}>
              {/* A Countach in profile. The shapes that make it one and not a
                  generic sports car: a nose that is nearly on the tarmac, a
                  windscreen raked back further than the bonnet is long, a roof
                  only a few units wide, a dead-flat rear deck, and the wing on
                  two struts. Drawn low and wide, then scaled up to fill the
                  disc — a wedge at natural size leaves the top and bottom of a
                  circle empty. */}
              {/* Red, outlined, like every other object on the site — a solid
                  black silhouette was the only icon here with no fill, and it
                  read as a shadow rather than a car. The wing is a thin plate on
                  short struts; tall struts made it a roll bar. */}
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <g
                  transform="translate(-5 -1) scale(1.1)"
                  stroke="var(--ink)"
                  strokeWidth="5"
                  strokeLinejoin="round"
                >
                  <path d="M79 34 L79 44 M90 34 L90 44" strokeLinecap="round" />
                  <path d="M73 29 L97 29 L97 34 L73 34 Z" fill="var(--ink)" />

                  {/* One wedge: nose almost on the floor, windscreen raked back
                      further than the bonnet is long, a roof barely wider than
                      the screen, then a flat deck to the tail. */}
                  <path
                    d="M5 57 L10 48 L36 44 L46 33 L61 33 L71 41 L95 44 L97 51 L97 57 Z"
                    fill="var(--stamp)"
                  />
                  <path d="M47 43 L50 36 L60 36 L66 42 Z" fill="var(--cream)" strokeWidth="3.5" />
                  <path d="M66 47 L79 49 L79 52 L66 51 Z" fill="var(--ink)" strokeWidth="0" />

                  <circle cx="28" cy="58" r="10.5" fill="var(--ink)" />
                  <circle cx="77" cy="58" r="11.5" fill="var(--ink)" />
                  <circle cx="28" cy="58" r="4" fill="var(--cream)" strokeWidth="0" />
                  <circle cx="77" cy="58" r="4.5" fill="var(--cream)" strokeWidth="0" />
                </g>
              </svg>
            </span>
            <span className={s.spendLabel}>LAMBO</span>
          </button>

          <button
            className={s.spendBtn}
            disabled={spent}
            onClick={() => spendOn("pizza")}
            aria-label="Spend it on pizza"
          >
            <span className={s.spendDisc}>
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <path
                  d="M50 10 L86 82 Q50 96 14 82 Z"
                  fill={COIN_COLOR.tendies}
                  stroke="var(--ink)"
                  strokeWidth="6"
                  strokeLinejoin="round"
                />
                <circle cx="42" cy="56" r="6" fill="var(--stamp)" />
                <circle cx="62" cy="64" r="6" fill="var(--stamp)" />
                <circle cx="50" cy="76" r="5" fill="var(--stamp)" />
              </svg>
            </span>
            <span className={s.spendLabel}>PIZZA</span>
          </button>

          <button
            className={s.spendBtn}
            disabled={spent}
            onClick={() => spendOn("memes")}
            aria-label="Spend it on more memes"
          >
            <span className={s.spendDisc}>
              {/* The actual coins, not a generic smiley. These are the same
                  three from the shared roster the rest of the site feeds into
                  the machine, drawn from the same glyph data — so "more memes"
                  means more of the ones you just locked, and the icon can never
                  drift out of sync with the roster. The glyphs are authored in a
                  100-unit box, hence the scale factor against each radius. */}
              <svg viewBox="0 0 100 100" aria-hidden="true">
                {[
                  { coin: COINS[0], cx: 27, cy: 48, r: 20 },
                  { coin: COINS[5], cx: 73, cy: 48, r: 20 },
                  { coin: COINS[1], cx: 50, cy: 58, r: 25 },
                ].map(({ coin, cx, cy, r }) => (
                  <g key={coin.ticker} transform={`translate(${cx} ${cy})`}>
                    <circle r={r} fill={coin.bg} stroke="var(--ink)" strokeWidth="6" />
                    <g
                      transform={`scale(${(1.5 * r) / 100}) translate(-50 -50)`}
                      fill={coin.glyphOn}
                    >
                      {coin.glyph}
                    </g>
                  </g>
                ))}
                <g stroke="var(--ink)" strokeWidth="5" strokeLinecap="round">
                  <circle cx="82" cy="18" r="13" fill="var(--cream)" />
                  <path d="M82 12 V24 M76 18 H88" />
                </g>
              </svg>
            </span>
            <span className={s.spendLabel}>MORE MEMES</span>
          </button>
        </div>

        <div className="cue">
          <span>Scroll ↓</span>
        </div>
      </div>
    </section>
  );
}
