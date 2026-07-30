"use client";

import { useCallback, useId, useState } from "react";
import { Modal } from "./protocol/Modal";
import { Ruler } from "./protocol/Ruler";
import { BORROWED, COLLATERAL, type Token } from "./protocol/tokens";
import { LIQ_LTV, MAX_LTV, UI_MAX_LTV, healthLabel, healthOf } from "@/lib/health";
import { useEntrance } from "@/lib/useEntrance";
import s from "./ProtocolSection.module.css";
import t from "./protocol/theme.module.css";

/**
 * The one switch that arms this screen.
 *
 * False means there is no wallet code on the page at all — not disabled code,
 * none — and the site's `connect-src 'self'` keeps it that way at the policy
 * level too. The form is fully explorable: pick a coin, set a ratio, watch the
 * numbers move. What it will not do is claim it sent anything.
 *
 * The site already uses this convention twice: `JoinSection` holds
 * `CONTRACT = null` and renders "Coming soon", and `HeroSection` holds
 * `BUY_URL = "#"` and answers a click with "soon."
 *
 * Turning it on is one word here plus widening `connect-src` in `_headers` and
 * `layout.tsx` to the named RPC origins — never to `*`.
 */
const LIVE = false;

type Tab = "borrow" | "positions";
type Theme = "light" | "dark";

/** Commas while you read, none while you type — the caret jumps otherwise. */
function group(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function ProtocolSection() {
  const ref = useEntrance<HTMLElement>();
  const amountId = useId();

  const [tab, setTab] = useState<Tab>("borrow");
  const [theme, setTheme] = useState<Theme>("light");
  const [coin, setCoin] = useState<Token>(COLLATERAL[0]);
  const [amount, setAmount] = useState("1000");
  const [ltv, setLtv] = useState(50);
  const [picking, setPicking] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const health = healthOf(ltv);
  const locked = Number(amount.replace(/,/g, "")) || 0;
  /* Deliberately a share of value, not a token count. There is no oracle on this
     page and inventing a price to fill the field would be inventing a fact. When
     a contract is wired to this screen the same row shows the real figure. */
  const borrowShare = Math.round(ltv);

  const reset = useCallback(() => {
    setPicking(false);
    setExplaining(false);
    setReviewing(false);
  }, []);

  return (
    <section className={`stage ${t.tokens} ${s.stage}`} data-p1-theme={theme} ref={ref}>
      <div className="top" data-ent="fade" data-ent-delay="0">
        <div className={s.tabs} role="tablist" aria-label="Borrow or positions">
          {(["borrow", "positions"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`${s.tab} ${tab === id ? s.tabOn : ""}`}
              onClick={() => {
                setTab(id);
                reset();
              }}
            >
              {id === "borrow" ? "Borrow" : "Positions"}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={s.theme}
          onClick={() => setTheme((v) => (v === "light" ? "dark" : "light"))}
          aria-label={theme === "light" ? "Switch to dark" : "Switch to light"}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor">
            {theme === "light" ? (
              <path
                d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            ) : (
              <>
                <circle cx="12" cy="12" r="4.2" strokeWidth="2" />
                <path
                  d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </>
            )}
          </svg>
        </button>
      </div>

      <div className="head" data-ent="up" data-ent-delay="90">
        <h1 className={s.h1}>
          Borrow <span className={s.token}>{BORROWED}</span> against your memes.
        </h1>
      </div>

      <div className={`middle ${s.middle}`} data-ent="up" data-ent-delay="240">
        <div className={s.card}>
          {tab === "borrow" ? (
            <>
              <label className={s.rowLabel} htmlFor={amountId}>
                Lock
              </label>
              <div className={s.field}>
                <input
                  id={amountId}
                  className={s.amount}
                  /* text + inputmode, not type="number": a number input drops the
                     caret to the end on every reformat and refuses a lone dot. */
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
                  onBlur={() => setAmount(locked ? group(locked) : "")}
                  aria-describedby={`${amountId}-note`}
                />
                <button type="button" className={s.pick} onClick={() => setPicking(true)}>
                  <span className={s.dot} style={{ background: coin.bg, color: coin.on }}>
                    {coin.sym.slice(0, 1)}
                  </span>
                  {coin.sym}
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M7 10l5 5 5-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>

              <Ruler ltv={ltv} onChange={setLtv} interactive label="How much to borrow" />

              <dl className={s.summary}>
                <div>
                  <dt>Borrow</dt>
                  <dd className={s.big} data-health={health}>
                    {borrowShare}%
                    <small>of its value, in {BORROWED}</small>
                  </dd>
                </div>
                <div>
                  <dt>Loan to value</dt>
                  <dd data-health={health}>
                    {borrowShare}% · {healthLabel(health)}
                  </dd>
                </div>
                <div>
                  <dt>Liquidated at</dt>
                  <dd>{LIQ_LTV}%</dd>
                </div>
              </dl>

              <p className={s.note} id={`${amountId}-note`}>
                Most you can borrow is {MAX_LTV}%. Past {LIQ_LTV}% your collateral is
                sold in full and you keep nothing.{" "}
                <button type="button" className={s.link} onClick={() => setExplaining(true)}>
                  How liquidation works
                </button>
              </p>

              <button
                type="button"
                className={s.primary}
                onClick={() => setReviewing(true)}
                data-live={LIVE}
              >
                {LIVE ? "Review borrow" : "See what this would do"}
              </button>
            </>
          ) : (
            <div className={s.empty}>
              <p className={s.emptyTitle}>No positions yet</p>
              <p className={s.emptyBody}>
                Nothing is connected to this page yet, so there is nothing to show. When a
                contract is wired up, every loan you open appears here with its own ruler
                on this same scale.
              </p>
              <button type="button" className={s.ghost} onClick={() => setTab("borrow")}>
                Back to borrowing
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bottom">
        <p className={s.foot}>
          Not live yet — no wallet, no contract, nothing to sign.
        </p>
        <div className="cue">
          <span>Scroll ↓</span>
        </div>
      </div>

      {/* ---------------- popups ---------------- */}

      <Modal
        theme={theme}
        open={picking}
        onClose={() => setPicking(false)}
        title="Choose collateral"
      >
        <ul className={s.coinList}>
          {COLLATERAL.map((c) => (
            <li key={c.sym}>
              <button
                type="button"
                className={`${s.coinRow} ${c.sym === coin.sym ? s.coinOn : ""}`}
                onClick={() => {
                  setCoin(c);
                  setPicking(false);
                }}
              >
                <span className={s.dot} style={{ background: c.bg, color: c.on }}>
                  {c.sym.slice(0, 1)}
                </span>
                <span className={s.coinName}>
                  <b>{c.sym}</b>
                  <small>{c.name}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className={s.note}>
          Robinhood Chain memecoins. The list is set by the contract, so it can change
          without this page changing.
        </p>
      </Modal>

      <Modal
        theme={theme}
        open={explaining}
        onClose={() => setExplaining(false)}
        title="How liquidation works"
      >
        <dl className={s.terms}>
          <div>
            <dt>You may borrow up to</dt>
            <dd>{MAX_LTV}% of what you lock</dd>
          </div>
          <div>
            <dt>You are liquidated at</dt>
            <dd className={s.bad}>{LIQ_LTV}%</dd>
          </div>
          <div>
            <dt>How much is sold</dt>
            <dd className={s.bad}>All of it</dd>
          </div>
        </dl>
        <p className={s.note}>
          This is harsher than most lending. There is no partial liquidation and no
          grace: once the ratio touches {LIQ_LTV}%, the whole position is sold to clear
          the debt. Adding collateral or repaying is allowed at any time, including when
          you are already past the {MAX_LTV}% limit — those two only ever improve your
          position, so they are never blocked.
        </p>
      </Modal>

      <Modal
        theme={theme}
        open={reviewing}
        onClose={() => setReviewing(false)}
        title={LIVE ? "Review your loan" : "What this would do"}
        footer={
          <>
            <p className={s.note}>
              Nothing was sent. There is no wallet on this page and no contract behind
              it yet.
            </p>
            <button type="button" className={s.ghost} onClick={() => setReviewing(false)}>
              Close
            </button>
          </>
        }
      >
        <dl className={s.terms}>
          <div>
            <dt>You lock</dt>
            <dd>
              {group(locked)} {coin.sym}
            </dd>
          </div>
          <div>
            <dt>You borrow</dt>
            <dd>
              {borrowShare}% of its value in {BORROWED}
            </dd>
          </div>
          <div>
            <dt>Loan to value</dt>
            <dd data-health={health}>
              {borrowShare}% · {healthLabel(health)}
            </dd>
          </div>
          <div>
            <dt>Liquidated at</dt>
            <dd className={s.bad}>{LIQ_LTV}% — all of it sold</dd>
          </div>
        </dl>
        <Ruler ltv={ltv} />
        <p className={s.note}>
          The ruler is drawn 0 to 100 here and on every position, so the {MAX_LTV} and{" "}
          {LIQ_LTV} marks are always in the same place. The most this page will let you
          reach is {UI_MAX_LTV}% rather than a round {MAX_LTV}% — the contract rounds
          against the borrower, and a loan set to exactly {MAX_LTV}% would be refused.
        </p>
      </Modal>
    </section>
  );
}
