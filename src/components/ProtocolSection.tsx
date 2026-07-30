"use client";

import { useCallback, useId, useMemo, useState } from "react";
import type { Address } from "viem";
import { Modal } from "./protocol/Modal";
import { Positions } from "./protocol/Positions";
import { Ruler } from "./protocol/Ruler";
import { TxStatus } from "./protocol/TxStatus";
import { WalletChip } from "./protocol/WalletChip";
import { BORROWED, ROSTER, rosterEntry } from "./protocol/tokens";
import { lendingAbi } from "@/lib/abi";
import { DEPLOYMENT, publicClient } from "@/lib/chain";
import { LIQ_LTV, MAX_LTV, UI_MAX_LTV, healthLabel, healthOf } from "@/lib/health";
import {
  borrowableCB,
  exactAmount,
  formatAmount,
  parseAmount,
  useMarket,
  usePositions,
  usePrices,
  useTokenBalance,
} from "@/lib/protocol";
import { approvalStep, useTx, type Step } from "@/lib/tx";
import { useWallet } from "@/lib/wallet";
import { EXPLORER_ORIGIN } from "@/lib/rpc";
import { useEntrance } from "@/lib/useEntrance";
import s from "./ProtocolSection.module.css";
import t from "./protocol/theme.module.css";

/**
 * The kill switch, and it is a real one.
 *
 * It used to change two strings and nothing else, while the footer went on
 * saying "not live" underneath a button labelled "Review borrow" — so the one
 * word that was supposed to arm the screen produced a screen that contradicted
 * itself. Everything that can send a transaction is now behind this, and so is
 * every sentence that claims nothing can be sent. Flip it to false and the
 * screen is honestly inert again: no wallet, no confirm, no claim.
 *
 * Reads are deliberately outside it. The collateral roster, the inventory and
 * the prices come off chain either way, because a page that invents a coin list
 * is wrong whether or not it can sign.
 */
const LIVE = true;

type Tab = "borrow" | "positions";
type Theme = "light" | "dark";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function ProtocolSection() {
  const ref = useEntrance<HTMLElement>();
  const amountId = useId();

  const [tab, setTab] = useState<Tab>("borrow");
  const [theme, setTheme] = useState<Theme>("light");
  const [chosen, setChosen] = useState<Address>();
  const [amount, setAmount] = useState("");
  const [ltv, setLtv] = useState(50);
  const [picking, setPicking] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const wallet = useWallet();
  const market = useMarket();
  const positions = usePositions(LIVE ? wallet.account : undefined);
  const tx = useTx();

  /* Memoised because the `?? []` would otherwise mint a new array on every
     render while the market is still loading, which is enough to make every
     downstream useMemo recompute forever. */
  const collateral = useMemo(() => market.data?.collateral ?? [], [market.data]);
  /* Default to the first coin the contract will still open a position against,
     not simply the first in the list: a disabled coin at index 0 would greet
     every visitor with a form that cannot be submitted. */
  const coin =
    collateral.find((c) => c.address === chosen) ?? collateral.find((c) => c.enabled) ?? collateral[0];

  /* The picker's rows: every coin on the roster in its approved order, each
     carrying the contract's token when there is one, then anything the contract
     lists that the roster has never heard of. */
  const pickerRows = useMemo(() => {
    const live = new Map(collateral.map((c) => [c.symbol.toUpperCase(), c]));
    const rows = ROSTER.map((meta) => ({ meta, token: live.get(meta.sym) }));
    const extra = collateral
      .filter((c) => !rosterEntry(c.symbol))
      .map((c) => ({ meta: { sym: c.symbol, name: c.name, bg: c.bg, on: c.on }, token: c }));
    return [...rows, ...extra];
  }, [collateral]);

  const prices = usePrices(coin, market.data?.cbDecimals);
  const balance = useTokenBalance(LIVE ? coin?.address : undefined, wallet.account);

  const cbDecimals = market.data?.cbDecimals ?? 18;
  const lockedWei = coin ? parseAmount(amount, coin.decimals) : 0n;
  const borrowWei = useMemo(
    () =>
      coin && prices.data
        ? borrowableCB(lockedWei, Math.round(ltv) * 100, prices.data, coin.decimals, cbDecimals)
        : 0n,
    [coin, prices.data, lockedWei, ltv, cbDecimals]
  );

  const health = healthOf(ltv);

  const reset = useCallback(() => {
    setPicking(false);
    setExplaining(false);
    setReviewing(false);
  }, []);

  // --- what stands between this form and a signature -----------------------

  const enoughInventory = market.data ? borrowWei <= market.data.available : true;
  const overBalance = balance !== undefined && lockedWei > balance;
  const underMinimum = !!coin && lockedWei > 0n && lockedWei < coin.minCollateral;

  const blocker =
    !market.data
      ? undefined
      : market.data.paused
        ? "New borrowing is paused right now. Repaying and adding collateral still work."
        : coin && !coin.enabled
          ? `${coin.symbol} is not being accepted for new loans at the moment.`
          : overBalance
            ? `That is more ${coin?.symbol ?? ""} than this wallet holds.`
            : underMinimum
              ? `The contract sets a minimum of ${formatAmount(coin!.minCollateral, coin!.decimals)} ${coin!.symbol} to open with.`
              : !enoughInventory
                ? `The desk only has ${formatAmount(market.data.available, cbDecimals)} ${BORROWED} left to lend.`
                : undefined;

  const ready = !!coin && !!prices.data && lockedWei > 0n && borrowWei > 0n && !blocker;

  const cta = !LIVE
    ? { label: "See what this would do", onClick: () => setReviewing(true), disabled: !ready }
    : !wallet.ready || market.loading
      ? { label: "Reading the chain…", onClick: undefined, disabled: true }
      : !wallet.hasProvider
        ? { label: "No wallet found in this browser", onClick: undefined, disabled: true }
        : !wallet.account
          ? { label: "Connect wallet", onClick: wallet.connect, disabled: wallet.connecting }
          : wallet.wrongNetwork
            ? { label: "Switch to Robinhood Chain", onClick: wallet.switchNetwork, disabled: false }
            : { label: "Review borrow", onClick: () => setReviewing(true), disabled: !ready };

  // --- the write ------------------------------------------------------------

  const confirm = async () => {
    if (!LIVE || !wallet.walletClient || !wallet.account || !coin || !ready) return;
    const client = wallet.walletClient;
    const account = wallet.account;

    const steps: Step[] = [
      ...(await approvalStep(client, account, coin.address, coin.symbol, lockedWei)),
      {
        label: "Opening the loan",
        run: async () => {
          const { request } = await publicClient.simulateContract({
            account,
            address: DEPLOYMENT.lending,
            abi: lendingAbi,
            functionName: "openPosition",
            args: [coin.address, lockedWei, borrowWei],
          });
          return client.writeContract(request);
        },
      },
    ];

    if (await tx.send(steps)) {
      setAmount("");
      market.refresh();
      positions.refresh();
    }
  };

  const afterSuccess = tx.state.phase === "done";

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

        <div className={s.topRight}>
          {LIVE ? <WalletChip wallet={wallet} /> : null}
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
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
                  aria-describedby={`${amountId}-note`}
                />
                <button
                  type="button"
                  className={s.pick}
                  onClick={() => setPicking(true)}
                  disabled={collateral.length === 0}
                >
                  <span className={s.dot} style={{ background: coin?.bg, color: coin?.on }}>
                    {coin?.symbol.slice(0, 1) ?? "?"}
                  </span>
                  {coin?.symbol ?? "—"}
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

              {LIVE && balance !== undefined && coin ? (
                <p className={s.balance}>
                  Wallet: {formatAmount(balance, coin.decimals)} {coin.symbol}
                  <button
                    type="button"
                    className={s.max}
                    onClick={() => setAmount(exactAmount(balance, coin.decimals))}
                  >
                    Max
                  </button>
                </p>
              ) : null}

              <Ruler ltv={ltv} onChange={setLtv} interactive label="How much to borrow" />

              <dl className={s.summary}>
                <div>
                  <dt>Borrow</dt>
                  <dd className={s.big} data-health={health}>
                    {prices.data ? formatAmount(borrowWei, cbDecimals) : "—"}
                    <small>
                      {BORROWED} · {Math.round(ltv)}% of its value
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>Loan to value</dt>
                  <dd data-health={health}>
                    {Math.round(ltv)}% · {healthLabel(health)}
                  </dd>
                </div>
                <div>
                  <dt>Liquidated at</dt>
                  <dd>{LIQ_LTV}%</dd>
                </div>
              </dl>

              <p className={s.note} id={`${amountId}-note`}>
                Most you can borrow is {MAX_LTV}%. Past {LIQ_LTV}% your collateral is sold in full
                and you keep nothing.{" "}
                <button type="button" className={s.link} onClick={() => setExplaining(true)}>
                  How liquidation works
                </button>
              </p>

              {market.error ? <p className={s.problem}>{market.error}</p> : null}
              {prices.error ? <p className={s.problem}>{prices.error}</p> : null}
              {blocker ? <p className={s.problem}>{blocker}</p> : null}

              <button
                type="button"
                className={s.primary}
                onClick={cta.onClick}
                disabled={cta.disabled}
              >
                {cta.label}
              </button>

              <TxStatus state={tx.state} onDismiss={tx.reset} />
            </>
          ) : (
            <Positions
              market={market.data}
              wallet={wallet}
              positions={positions.data}
              loading={positions.loading}
              error={positions.error}
              onChanged={() => {
                positions.refresh();
                market.refresh();
              }}
            />
          )}
        </div>
      </div>

      <div className="bottom">
        <p className={s.foot}>
          {LIVE ? (
            <>
              Robinhood Chain ·{" "}
              <a
                className={s.footLink}
                href={`${EXPLORER_ORIGIN}/address/${DEPLOYMENT.lending}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                {short(DEPLOYMENT.lending)}
              </a>
            </>
          ) : (
            <>Not live yet — no wallet, no contract, nothing to sign.</>
          )}
        </p>
        <div className="cue">
          <span>Scroll ↓</span>
        </div>
      </div>

      {/* ---------------- popups ---------------- */}

      <Modal theme={theme} open={picking} onClose={() => setPicking(false)} title="Choose collateral">
        {market.loading && collateral.length === 0 ? (
          <p className={s.note}>Reading the collateral list from the contract…</p>
        ) : (
          <ul className={s.coinList}>
            {/* The running order is the roster's, not the contract's. A row is
                live when the contract lists that symbol and dead otherwise —
                the design's six stay in their approved sequence either way, and
                anything whitelisted that is not on the roster is appended below
                with whatever it calls itself. */}
            {pickerRows.map(({ meta, token }) => (
              <li key={meta.sym}>
                <button
                  type="button"
                  className={`${s.coinRow} ${token?.address === coin?.address ? s.coinOn : ""}`}
                  disabled={!token}
                  /* Not `aria-disabled`: there is genuinely nothing to choose.
                     The contract has no address for this coin, so a click could
                     only produce InvalidPool() from somewhere further in. */
                  onClick={() => {
                    if (!token) return;
                    setChosen(token.address);
                    setPicking(false);
                  }}
                >
                  <span className={s.dot} style={{ background: meta.bg, color: meta.on }}>
                    {meta.sym.slice(0, 1)}
                  </span>
                  <span className={s.coinName}>
                    <b>{meta.sym}</b>
                    <small>
                      {!token
                        ? `${meta.name} — not listed yet`
                        : token.enabled
                          ? meta.name
                          : `${meta.name} — closed to new loans`}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className={s.note}>
          Robinhood Chain memecoins. Which of them can be borrowed against is read from the
          contract, so it changes when the contract does, without this page changing.
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
          This is harsher than most lending. There is no partial liquidation and no grace: once the
          ratio touches {LIQ_LTV}%, the whole position is sold to clear the debt, and whatever it
          fetches above the debt goes to the keeper who cleared it, not to you. Adding collateral or
          repaying is allowed at any time, including when you are already past the {MAX_LTV}% limit —
          those two only ever improve your position, so they are never blocked.
        </p>
      </Modal>

      <Modal
        theme={theme}
        open={reviewing}
        onClose={() => {
          setReviewing(false);
          if (afterSuccess) tx.reset();
        }}
        title={LIVE ? "Review your loan" : "What this would do"}
        footer={
          <>
            {LIVE ? (
              afterSuccess ? (
                <button
                  type="button"
                  className={s.primary}
                  onClick={() => {
                    setReviewing(false);
                    tx.reset();
                    setTab("positions");
                  }}
                >
                  See your position
                </button>
              ) : (
                <button
                  type="button"
                  className={s.primary}
                  onClick={confirm}
                  disabled={tx.state.phase === "signing" || tx.state.phase === "pending" || !ready}
                >
                  {tx.state.phase === "signing" || tx.state.phase === "pending"
                    ? "Working…"
                    : "Confirm in wallet"}
                </button>
              )
            ) : (
              <p className={s.note}>
                Nothing was sent. There is no wallet on this page and no contract behind it yet.
              </p>
            )}
            <button
              type="button"
              className={s.ghost}
              onClick={() => {
                setReviewing(false);
                if (afterSuccess) tx.reset();
              }}
            >
              Close
            </button>
          </>
        }
      >
        <dl className={s.terms}>
          <div>
            <dt>You lock</dt>
            <dd>
              {coin ? formatAmount(lockedWei, coin.decimals) : "—"} {coin?.symbol ?? ""}
            </dd>
          </div>
          <div>
            <dt>You borrow</dt>
            <dd>
              {formatAmount(borrowWei, cbDecimals)} {BORROWED}
            </dd>
          </div>
          <div>
            <dt>Loan to value</dt>
            <dd data-health={health}>
              {Math.round(ltv)}% · {healthLabel(health)}
            </dd>
          </div>
          <div>
            <dt>Liquidated at</dt>
            <dd className={s.bad}>{LIQ_LTV}% — all of it sold</dd>
          </div>
        </dl>
        <Ruler ltv={ltv} />
        <p className={s.note}>
          Priced from the contract&rsquo;s own TWAP oracle at the moment you opened this dialog, and
          checked against the contract before it reaches your wallet. The most this page will let you
          reach is {UI_MAX_LTV}% rather than a round {MAX_LTV}% — the contract rounds against the
          borrower, and a loan set to exactly {MAX_LTV}% would be refused.
        </p>
        {LIVE ? <TxStatus state={tx.state} onDismiss={tx.reset} /> : null}
      </Modal>
    </section>
  );
}
