"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MASCOT_HREF } from "./Mascot";
import { COIN_COLOR } from "./coins";
import { useEntrance, prefersReducedMotion } from "@/lib/useEntrance";
import s from "./PlaygroundSection.module.css";

type MoodKey = "jump" | "spin" | "rage" | "fat" | "shy" | "sleep";

interface MoodDef {
  ms: number;
  say: string;
  hint: string;
  cls: string;
}

const MOODS: Record<MoodKey, MoodDef> = {
  jump:  { ms: 950,  say: "up.",             hint: "Again?",               cls: s.mJump },
  // These must not undershoot the CSS durations: the class comes off when the
  // timer fires, and pulling it mid-move snaps him back to his resting pose.
  spin:  { ms: 1150, say: "dizzy now.",      hint: "Do not do that again.", cls: s.mSpin },
  rage:  { ms: 3040, say: "i am very calm.", hint: "He is not calm.",       cls: s.mRage },
  fat:   { ms: 1600, say: "this is muscle.", hint: "Sure.",                 cls: s.mFat },
  shy:   { ms: 1900, say: "stop looking.",   hint: "He is embarrassed.",    cls: s.mShy },
  sleep: { ms: 3000, say: "later.",          hint: "Let him rest.",         cls: s.mSleep },
};

const ALL_KEYS = Object.keys(MOODS) as MoodKey[];

/**
 * The six buttons wear the six coin colours.
 *
 * They used to carry six invented hues, three of which happened to duplicate a
 * coin or a token exactly and three of which existed nowhere else on the site.
 * Borrowing from the roster means the playground is tinted in the same six
 * colours the first screen taught you, and adds nothing to the palette.
 *
 * Icon fill follows the disc: ink on the four light ones, cream on the two dark.
 */
const MOOD_BUTTONS: { key: MoodKey; label: string; bg: string; icon: React.ReactNode }[] = [
  {
    key: "jump", label: "JUMP", bg: COIN_COLOR.littlejohn,
    icon: (
      <svg viewBox="0 0 100 100" fill="var(--cream)" aria-hidden="true">
        <path d="M50 14 L64 40 L50 32 L36 40 Z" />
        <rect x="42" y="44" width="16" height="30" rx="6" />
        <ellipse cx="50" cy="84" rx="26" ry="7" />
      </svg>
    ),
  },
  {
    key: "spin", label: "SPIN", bg: COIN_COLOR.cashdog,
    icon: (
      <svg viewBox="0 0 100 100" fill="none" stroke="var(--ink)" strokeWidth="9" strokeLinecap="round" aria-hidden="true">
        <path d="M76 34 a32 32 0 1 0 8 22" />
        <path d="M84 24 v30 h-28" />
      </svg>
    ),
  },
  {
    key: "rage", label: "RAGE", bg: COIN_COLOR.yolo,
    icon: (
      <svg viewBox="0 0 100 100" fill="var(--cream)" aria-hidden="true">
        <path d="M54 8 L26 56 h20 l-8 36 30 -50 h-20 z" />
      </svg>
    ),
  },
  {
    key: "fat", label: "INFLATE", bg: COIN_COLOR.tendies,
    icon: (
      <svg viewBox="0 0 100 100" fill="var(--ink)" aria-hidden="true">
        <ellipse cx="50" cy="56" rx="34" ry="28" />
        <path d="M16 26 q34 -16 68 0" fill="none" stroke="var(--ink)" strokeWidth="8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "shy", label: "SHY", bg: COIN_COLOR.ansemcat,
    icon: (
      <svg viewBox="0 0 100 100" fill="var(--cream)" aria-hidden="true">
        <path d="M50 84 C6 56 20 16 50 34 C80 16 94 56 50 84 Z" />
      </svg>
    ),
  },
  {
    key: "sleep", label: "NAP", bg: COIN_COLOR.cashcat,
    icon: (
      <svg viewBox="0 0 100 100" fill="var(--ink)" aria-hidden="true">
        <path d="M62 12 a38 38 0 1 0 26 62 A42 42 0 0 1 62 12 Z" />
      </svg>
    ),
  },
];

export function PlaygroundSection() {
  const ref = useEntrance<HTMLElement>();
  const yardRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SVGSVGElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const bubbleTimer = useRef<number | undefined>(undefined);
  const moodTimer = useRef<number | undefined>(undefined);
  const lastPoke = useRef<MoodKey | null>(null);
  const rafId = useRef<number | null>(null);
  const target = useRef({ x: 0, y: 0 });
  const [moodCls, setMoodCls] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("Move your cursor — then press one");
  const [activeBtn, setActiveBtn] = useState<MoodKey | null>(null);

  const say = useCallback((text: string) => {
    const el = bubbleRef.current;
    if (!el) return;
    el.textContent = text;
    el.classList.add("show");
    window.clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(
      () => el.classList.remove("show"),
      1800
    );
  }, []);

  const play = useCallback((name: MoodKey) => {
    const m = MOODS[name];
    if (!m) return;
    const reduced = prefersReducedMotion();

    window.clearTimeout(moodTimer.current);
    setMoodCls("");
    setActiveBtn(null);
    setBusy(false);

    // The class has to come off and go back on across two commits. Reading
    // offsetWidth here used to stand in for that, but React has committed
    // nothing at this point for the read to flush — so the class went from
    // mJump straight back to mJump, no attribute change, no restart, and
    // pressing a button a second time did nothing at all.
    requestAnimationFrame(() => {
      setMoodCls(m.cls);
      setBusy(true);
      setActiveBtn(name);
      say(m.say);
      setHint(m.hint);

      moodTimer.current = window.setTimeout(() => {
        setMoodCls("");
        setBusy(false);
        setActiveBtn(null);
        setHint("Pick another");
      }, reduced ? 60 : m.ms);
    });
  }, [say]);

  const handleSceneClick = useCallback(() => {
    const pool = ALL_KEYS.filter((k) => k !== lastPoke.current);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    lastPoke.current = pick;
    play(pick);
  }, [play]);

  useEffect(() => {
    const reduced = prefersReducedMotion();
    if (reduced) return;

    const apply = () => {
      rafId.current = null;
      const yard = yardRef.current;
      if (!yard) return;
      yard.style.setProperty("--px", target.current.x.toFixed(3));
      yard.style.setProperty("--py", target.current.y.toFixed(3));
      yard.style.setProperty("--pa", Math.abs(target.current.x).toFixed(3));
    };

    const track = (e: PointerEvent) => {
      const scene = sceneRef.current;
      if (!scene) return;
      const r = scene.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.62;
      target.current.x = Math.max(-1, Math.min(1, (e.clientX - cx) / (r.width * 0.55)));
      target.current.y = Math.max(-1, Math.min(1, (e.clientY - cy) / (r.height * 0.6)));
      if (!rafId.current) rafId.current = requestAnimationFrame(apply);
    };

    const reset = () => {
      target.current.x = 0;
      target.current.y = 0;
      if (!rafId.current) rafId.current = requestAnimationFrame(apply);
    };

    window.addEventListener("pointermove", track, { passive: true });
    window.addEventListener("pointerleave", reset);

    return () => {
      window.removeEventListener("pointermove", track);
      window.removeEventListener("pointerleave", reset);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(bubbleTimer.current);
      window.clearTimeout(moodTimer.current);
    };
  }, []);

  const stageClasses = [
    "stage",
    moodCls,
    busy ? s.busy : "",
  ].filter(Boolean).join(" ");

  return (
    <section className={stageClasses} ref={ref}>
      <div className="top" data-ent="fade" data-ent-delay="0">
        <div className="count">07 / 08</div>
      </div>

      <div className="head" data-ent="up" data-ent-delay="90">
        <h1 className="sticker">
          Poke <span className="hot">Capy Bear</span>.
        </h1>
      </div>

      <div className={`middle ${s.middle}`} data-ent="up" data-ent-delay="240">
        <div className={s.yard} ref={yardRef}>
          <div className={`bubble ${s.bubble}`} ref={bubbleRef}>
            hello.
          </div>

          <svg
            className={s.yardSvg}
            viewBox="190 120 380 360"
            ref={sceneRef}
            role="img"
            aria-label="Capybara Blyatovich, who reacts to you"
            onClick={handleSceneClick}
          >
            <ellipse
              className={s.shadow}
              cx="380" cy="452" rx="118" ry="20"
              fill="var(--ink)" opacity="0.14"
            />

            <g
              className={`${s.fx} ${s.fxDust}`}
              stroke="var(--ink)" strokeWidth="5"
              fill="none" strokeLinecap="round" opacity="0"
            >
              <path d="M262 448 q-26 -12 -44 -4" />
              <path d="M498 448 q26 -12 44 -4" />
            </g>

            <circle
              className={`${s.fx} ${s.fxSwoosh}`}
              cx="380" cy="330" r="132"
              fill="none" stroke="var(--gold)" strokeWidth="7"
              strokeLinecap="round" opacity="0"
            />

            <g
              className={`${s.fx} ${s.fxSteam}`}
              stroke="var(--stamp)" strokeWidth="7"
              fill="none" strokeLinecap="round" opacity="0"
            >
              <path d="M300 250 q-14 -22 2 -40" />
              <path d="M460 250 q14 -22 -2 -40" />
            </g>

            {/* Over on the left, because tipping onto his side carries his head
                across to about x=260 — off his right shoulder these drifted up
                from his feet. */}
            {/* No .fx on this wrapper: it carries opacity 0 and group opacity
                multiplies with the children's, so the z's could never appear no
                matter what their own animation did. Dust, steam and swoosh
                escape it because their .fx sits on the animated element. */}
            <g fontWeight="900" fontSize="34" fill="var(--ink)" opacity="0.8">
              <text className={s.fxZzz} x="252" y="318" opacity="0">z</text>
              <text className={s.fxZzz} x="252" y="318" opacity="0">z</text>
              <text className={s.fxZzz} x="252" y="318" opacity="0">z</text>
            </g>

            <g className={s.mood}>
              <g className={s.lean}>
                <g className="breathe">
                  <image
                    href={MASCOT_HREF}
                    x="256" y="196" width="248" height="256"
                    preserveAspectRatio="xMidYMax meet"
                  />

                  {/* No overlay pupils. He is drawn with his own — the black
                      half-disc under each lid — so a tracking dot on top was a
                      second pupil in every eye. It hid inside the painted one at
                      rest and slid out from under it the moment the cursor
                      moved, which is the two dots that were showing. The scene
                      still follows the cursor: the whole of him leans and his
                      shadow shifts, both off the same --px. */}

                </g>
              </g>
            </g>
          </svg>
        </div>
      </div>

      <div className="bottom">
        <div className="hint" data-ent="up" data-ent-delay="430">
          {hint}
        </div>

        <div className={s.pad} data-ent="up" data-ent-delay="500">
          {MOOD_BUTTONS.map((mb) => (
            <button
              key={mb.key}
              className={`sbtn ${s.mbtn} ${activeBtn === mb.key ? s.active : ""}`}
              style={{ "--disc-bg": mb.bg } as React.CSSProperties}
              onClick={() => play(mb.key)}
              aria-label={mb.label}
            >
              <span className="disc">{mb.icon}</span>
              <span className="slabel">{mb.label}</span>
            </button>
          ))}
        </div>

        <div className="cue" data-ent="up" data-ent-delay="570">
          <span>Scroll &darr;</span>
        </div>
      </div>
    </section>
  );
}
