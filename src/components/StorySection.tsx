"use client";

import { useCallback, useEffect, useState } from "react";
import { Mascot } from "./Mascot";
import { COIN_COLOR } from "./coins";
import { useEntrance, prefersReducedMotion } from "@/lib/useEntrance";
import { useReplay } from "@/lib/useReplay";
import { useAutoRearm } from "@/lib/useAutoRearm";
import s from "./StorySection.module.css";

type CardState = "idle" | "lifting" | "flipped";

const CARDS = [
  {
    pip: "1st",
    job: "An honest job",
    bg: COIN_COLOR.littlejohn,
    label: "Reveal what happened with the honest job",
    punch: "Lasted four hours.",
  },
  {
    pip: "2nd",
    job: "Day trading",
    bg: COIN_COLOR.yolo,
    label: "Reveal what happened with day trading",
    punch: "Down 94%. Twice.",
  },
  {
    pip: "3rd",
    job: "Asked a bank",
    bg: COIN_COLOR.ansemcat,
    label: "Reveal what happened with the bank",
    punch: "They laughed. No collateral.",
  },
];

export function StorySection() {
  const ref = useEntrance<HTMLElement>();
  const [cards, setCards] = useState<CardState[]>(["idle", "idle", "idle"]);
  const [showPayoff, setShowPayoff] = useState(false);

  const rearm = useCallback(() => {
    setCards(["idle", "idle", "idle"]);
    setShowPayoff(false);
  }, []);

  useReplay(ref, rearm);
  // The deck turns itself face down again once the payoff has been read, so the
  // three cards are not a one-shot.
  useAutoRearm(showPayoff, rearm, 5200);

  const flipCard = useCallback((i: number) => {
    setCards((prev) => {
      if (prev[i] !== "idle") return prev;
      const next = [...prev];
      next[i] = prefersReducedMotion() ? "flipped" : "lifting";
      return next;
    });

    if (!prefersReducedMotion()) {
      setTimeout(() => {
        setCards((prev) => {
          if (prev[i] !== "lifting") return prev;
          const next = [...prev];
          next[i] = "flipped";
          return next;
        });
      }, 300);
    }
  }, []);

  const allFlipped = cards.every((c) => c === "flipped");

  useEffect(() => {
    if (!allFlipped || showPayoff) return;
    const delay = prefersReducedMotion() ? 0 : 700;
    const timer = setTimeout(() => setShowPayoff(true), delay);
    return () => clearTimeout(timer);
  }, [allFlipped, showPayoff]);

  const flippedCount = cards.filter((c) => c !== "idle").length;
  const allTriggered = cards.every((c) => c !== "idle");

  // Above the deck: what is left to do. Below it: only the closing line, which
  // is a conclusion rather than an instruction.
  const deckLabel = allTriggered
    ? ""
    : flippedCount === 0
      ? "Turn them over"
      : flippedCount === 1
        ? "Two to go"
        : "One more";
  const hintText = showPayoff ? "And that is page five." : "";

  return (
    <section
      className={`stage ${showPayoff ? s.allDone : ""}`}
      ref={ref}
    >
      <div className="top" data-ent="fade" data-ent-delay="0">
        <div className="count">07 / 09</div>
      </div>

      <div className="head" data-ent="up" data-ent-delay="90">
        <h1 className="sticker">
          He tried <span className="hot">everything else</span> first.
        </h1>
      </div>

      <div className={`middle ${s.mid}`} data-ent="up" data-ent-delay="240">
        {/* Non-breaking space rather than an empty string: the label keeps its
            line box once the deck is spent, so the cards do not jump upward the
            moment the third one is turned. */}
        <div className={s.deckLabel}>{deckLabel || " "}</div>

        <div className={s.deck}>
          {CARDS.map((card, i) => {
            const state = cards[i];
            return (
              <button
                key={i}
                className={`${s.card} ${state === "flipped" ? s.flipped : ""} ${state === "lifting" ? s.lift : ""}`}
                onClick={() => flipCard(i)}
                style={{ "--disc-bg": card.bg } as React.CSSProperties}
                aria-label={card.label}
              >
                <span className={`${s.face} ${s.faceFront}`}>
                  <span className={s.pip}>{card.pip}</span>
                  <span className={s.cardArt}>
                    {i === 0 && (
                      <svg viewBox="0 0 100 100" aria-hidden="true">
                        <g
                          stroke="var(--ink)"
                          strokeWidth="6"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        >
                          <path d="M50 10 v46" fill="none" />
                          <rect
                            x="42"
                            y="4"
                            width="16"
                            height="12"
                            rx="4"
                            fill="var(--furniture-dark)"
                          />
                          <path
                            d="M32 56 h36 l-6 30 q-12 8 -24 0 z"
                            fill={COIN_COLOR.cashcat}
                          />
                        </g>
                      </svg>
                    )}
                    {i === 1 && (
                      <svg viewBox="0 0 100 100" aria-hidden="true">
                        <g
                          stroke="var(--ink)"
                          strokeWidth="6"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          fill="none"
                        >
                          <path d="M14 18 v66 h72" />
                          <path
                            d="M24 34 L44 52 L58 42 L82 74"
                            stroke="var(--stamp)"
                            strokeWidth="7"
                          />
                          <path
                            d="M82 60 v14 h-14"
                            stroke="var(--stamp)"
                            strokeWidth="7"
                          />
                        </g>
                      </svg>
                    )}
                    {i === 2 && (
                      <svg viewBox="0 0 100 100" aria-hidden="true">
                        <g
                          stroke="var(--ink)"
                          strokeWidth="6"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        >
                          <path
                            d="M12 40 L50 16 L88 40 Z"
                            fill="var(--cream)"
                          />
                          {/* Wider than they look like they need to be: at 12
                              across, a 6-wide stroke leaves 6 of fill and the
                              pillars render as three black bars. */}
                          <rect
                            x="20"
                            y="44"
                            width="16"
                            height="34"
                            fill="var(--cream)"
                          />
                          <rect
                            x="42"
                            y="44"
                            width="16"
                            height="34"
                            fill="var(--cream)"
                          />
                          <rect
                            x="64"
                            y="44"
                            width="16"
                            height="34"
                            fill="var(--cream)"
                          />
                          <rect
                            x="12"
                            y="80"
                            width="76"
                            height="10"
                            rx="3"
                            fill="var(--furniture-dark)"
                          />
                        </g>
                      </svg>
                    )}
                  </span>
                  <span className={s.cardJob}>{card.job}</span>
                </span>
                <span className={`${s.face} ${s.faceBack}`}>
                  <span className={s.punch}>{card.punch}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div
          className={`${s.payoff} sticker`}
        >
          So he built his own bank.
        </div>

        <div className={s.mascotWrap}>
          <Mascot
            className="breathe grounded"
            alt="Capybara Blyatovich"
          />
        </div>
      </div>

      <div className="bottom">
        <div className="hint" data-ent="up" data-ent-delay="430">
          {hintText}
        </div>
        <div
          className={s.tally}
          data-ent="up"
          data-ent-delay="470"
          aria-hidden="true"
        >
          {[0, 1, 2].map((i) => (
            <i
              key={i}
              className={`${s.dot} ${cards[i] !== "idle" ? s.dotOn : ""}`}
            />
          ))}
        </div>
        <div className="cue" data-ent="up" data-ent-delay="540">
          <span>Scroll ↓</span>
        </div>
      </div>
    </section>
  );
}
