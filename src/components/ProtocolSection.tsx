"use client";

import { useId, useMemo, useState } from "react";
import type { Address } from "viem";
import { Modal } from "./protocol/Modal";
import { Positions } from "./protocol/Positions";
import { Ruler } from "./protocol/Ruler";
import { TxStatus } from "./protocol/TxStatus";
/* Only BORROWED now. The roster is still consulted for order, names and
   colours — but in `loadMarket`, where it is applied to what the contract
   returned, rather than here where it used to generate rows of its own. */
import { BORROWED } from "./protocol/tokens";
import { lendingAbi } from "@/lib/abi";
import { DEPLOYMENT, publicClient } from "@/lib/chain";
import {
  LIQ_LTV,
  MAX_LTV,
  UI_MAX_LTV,
  dropToLiquidation,
  riskLabel,
  riskOf,
  riskTone,
} from "@/lib/health";
import {
  borrowForLtv,
  collateralForLtv,
  exactAmount,
  formatAmount,
  formatWeth,
  ltvPercentFor,
  parseAmount,
  useMarket,
  usePositions,
  useShortAddress,
  useTokenBalance,
  valueInWeth,
} from "@/lib/protocol";
import { BUY_URL, TOKEN_ADDRESS, externalLinkProps, isLive } from "@/lib/links";
import { approvalStep, useTx, type Step } from "@/lib/tx";
import { useWallet } from "@/lib/wallet";
import { useEntrance } from "@/lib/useEntrance";
import { MobileWalletLinks } from "./MobileWalletLinks";
import s from "./ProtocolSection.module.css";
import t from "./protocol/theme.module.css";

/**
 * The kill switch, and it is a real one.
 *
 * It used to change two strings and nothing else, while the footer went on
 * saying "not live" underneath a button labelled "Review borrow" — so the one
 * word that was supposed to arm the screen produced a screen that contradicted
 * itself. Everything that can send a transaction is now behind this, and so is
 * every sentence that claims nothing can be sent.
 *
 * Reads are deliberately outside it. The collateral roster, the inventory and
 * the prices come off chain either way, because a page that invents a coin list
 * is wrong whether or not it can sign.
 */
const LIVE = true;

/**
 * Where the ruler starts.
 *
 * Not zero. A form that opens at 0% asks the visitor to invent a ratio before it
 * will tell them anything, and the number most of them invent is the maximum.
 * 60% is the design's own opening position and it leaves a third of the
 * collateral's value as headroom — `dropToLiquidation(60)` is 33%, so the coin
 * has to fall by a third before liquidation.
 *
 * It is a starting point, not a floor or a ceiling: typing into the borrow field
 * or moving the ruler takes it over, and from then on the amount is the
 * visitor's, not ours.
 */
const DEFAULT_LTV = 60;

type Tab = "borrow" | "positions";
type Theme = "light" | "dark";
/** Which amount the visitor pinned. The ruler moves the other one. */
type Pin = "lock" | "borrow";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * Page 1: the borrow desk.
 *
 * Laid out from `design/borrow-screen.prototype.html` — the approved source
 * rather than a screenshot of it. Two fields with the ratio between them, not
 * one field and a percentage: the design's argument is that "lock this, receive
 * that" *is* the transaction, and a lone percentage leaves the visitor to do the
 * multiplication.
 *
 * Three things in the prototype are deliberately not ported, all of them noted
 * in `design/README.md`: an invented contract address, a `.example` explorer
 * that does not resolve, and a DEX link carrying neither chain nor output token.
 * The last is the most dangerous of the three on a memecoin site — `BUY_URL` in
 * `src/lib/links.ts` is what replaces it.
 */
export function ProtocolSection() {
  const ref = useEntrance<HTMLElement>();
  const lockId = useId();
  const borrowId = useId();

  const [tab, setTab] = useState<Tab>("borrow");
  const [theme, setTheme] = useState<Theme>("light");
  const [chosen, setChosen] = useState<Address>();
  const [lock, setLock] = useState("");
  const [borrow, setBorrow] = useState("");
  /* Until the borrow amount is the visitor's own, it is derived from the lock at
     DEFAULT_LTV. Tracked rather than written into state on every keystroke so a
     late price, a coin change or a cleared field all resolve on the next render
     instead of needing an effect to chase them. */
  const [borrowTouched, setBorrowTouched] = useState(false);
  const [pin, setPin] = useState<Pin>("lock");
  const [picking, setPicking] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [soon, setSoon] = useState(false);
  const [copied, setCopied] = useState(false);

  const wallet = useWallet();
  const market = useMarket();
  const positions = usePositions(LIVE ? wallet.account : undefined);
  const tx = useTx();
  const shortAccount = useShortAddress(wallet.account);

  const collateral = useMemo(() => market.data?.collateral ?? [], [market.data]);
  /* Default to the first coin the contract will still open a position against,
     not simply the first in the list: a disabled coin at index 0 would greet
     every visitor with a form that cannot be submitted. */
  const coin = useMemo(
    () =>
      collateral.find((c) => c.address === chosen) ??
      collateral.find((c) => c.enabled) ??
      collateral[0],
    [collateral, chosen]
  );

  const balance = useTokenBalance(LIVE ? coin?.address : undefined, wallet.account);

  const cbDecimals = market.data?.cbDecimals ?? 18;
  const cbUnitWeth = market.data?.cbUnitWeth ?? 0n;

  const lockWei = coin ? parseAmount(lock, coin.decimals) : 0n;

  /* The field's value, derived while untouched. Deriving rather than storing is
     what makes "type a lock amount and the borrow follows at 60%" survive the
     prices arriving a second later, or the coin being swapped underneath it. */
  const borrowValue =
    borrowTouched || !coin || lockWei <= 0n || cbUnitWeth <= 0n
      ? borrow
      : exactAmount(borrowForLtv(lockWei, DEFAULT_LTV, coin, cbDecimals, cbUnitWeth), cbDecimals);

  const borrowWei = parseAmount(borrowValue, cbDecimals);

  const ltv = coin ? ltvPercentFor(lockWei, borrowWei, coin, cbDecimals, cbUnitWeth) : 0;
  const risk = riskOf(ltv);
  const tone = riskTone(risk);
  const drop = dropToLiquidation(ltv);

  /** The most $CB the current lock supports, at the UI's shaded cap. */
  const maxBorrowWei = coin ? borrowForLtv(lockWei, UI_MAX_LTV, coin, cbDecimals, cbUnitWeth) : 0n;

  /**
   * The ruler moves whichever field is not pinned.
   *
   * LTV is a ratio, so dragging it can only change one side, and which side
   * depends on whether the visitor arrived saying "I am locking this much" or "I
   * want this much $CB". Whichever they typed into last is the one held.
   */
  /* A plain function, not a useCallback. The React Compiler is on for this repo
     and memoises this itself; a hand-written dependency array over values it
     already tracks makes it bail out of the whole component with "existing
     memoization could not be preserved", which is strictly worse than not
     writing one. */
  const setLtv = (next: number) => {
    if (!coin) return;
    if (pin === "lock") {
      setBorrow(exactAmount(borrowForLtv(lockWei, next, coin, cbDecimals, cbUnitWeth), cbDecimals));
      setBorrowTouched(true);
    } else {
      setLock(
        exactAmount(collateralForLtv(borrowWei, next, coin, cbDecimals, cbUnitWeth), coin.decimals)
      );
    }
  };

  // --- what stands between this form and a signature -----------------------

  const overBalance = balance !== undefined && lockWei > balance;
  const underMinimum = !!coin && lockWei > 0n && lockWei < coin.minCollateral;
  const overCap = ltv > UI_MAX_LTV;
  const enoughInventory = market.data ? borrowWei <= market.data.available : true;

  const blocker = !market.data
    ? undefined
    : market.data.paused
      ? "New borrowing is paused. Repaying and adding collateral still work."
      : coin && !coin.enabled
        ? `${coin.symbol} is not being accepted for new loans at the moment.`
        : overBalance
          ? `That is more ${coin?.symbol ?? ""} than this wallet holds.`
          : underMinimum
            ? `Below the ${formatAmount(coin!.minCollateral, coin!.decimals)} ${coin!.symbol} minimum this coin opens with.`
            : overCap
              ? `That works out at ${ltv.toFixed(1)}% — over the ${UI_MAX_LTV}% this page will let you reach.`
              : !enoughInventory
                ? `The desk only has ${formatAmount(market.data.available, cbDecimals)} ${BORROWED} left to lend.`
                : undefined;

  const ready = !!coin && lockWei > 0n && borrowWei > 0n && !blocker;

  const submit = async () => {
    if (!LIVE || !wallet.walletClient || !wallet.account || !coin || !ready) return;
    const client = wallet.walletClient;
    const account = wallet.account;

    const steps: Step[] = [
      ...(await approvalStep(client, account, coin.address, coin.symbol, lockWei)),
      {
        label: "Opening the loan",
        run: async () => {
          const { request } = await publicClient.simulateContract({
            account,
            address: DEPLOYMENT.lending,
            abi: lendingAbi,
            functionName: "openPosition",
            args: [coin.address, lockWei, borrowWei],
          });
          return client.writeContract(request);
        },
      },
    ];

    if (await tx.send(steps)) {
      setLock("");
      setBorrow("");
      setBorrowTouched(false);
      market.refresh();
      positions.refresh();
    }
  };

  /* No "no wallet found" branch any more. RainbowKit answers that case with its
     own "Get a wallet" flow, which is a better reply than a dead button — so
     somebody without an extension gets the same Connect button and is taken
     somewhere useful rather than told no. */
  const cta = !LIVE
    ? { label: "Not live yet", onClick: undefined, disabled: true }
    : !wallet.ready || market.loading
      ? { label: "Reading the chain…", onClick: undefined, disabled: true }
      : !wallet.account
        ? { label: "Connect wallet", onClick: wallet.connect, disabled: wallet.connecting }
        : wallet.wrongNetwork
          ? { label: "Switch to Robinhood Chain", onClick: wallet.switchNetwork, disabled: false }
          : { label: `Approve & borrow`, onClick: () => void submit(), disabled: !ready };

  // Copies the public token address, once there is one. Null until launch, so
  // the chip shows "coming soon" and this never runs before then.
  const copyContract = async () => {
    if (!TOKEN_ADDRESS) return;
    try {
      await navigator.clipboard.writeText(TOKEN_ADDRESS);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // A refused clipboard is not worth an error box.
    }
  };

  const openCount = positions.data?.length ?? 0;

  return (
    <section className={`stage ${t.tokens} ${s.stage}`} data-p1-theme={theme} ref={ref}>
      {/* ---------------- top bar ----------------
          One line, three zones: identity and navigation left, the call to action
          centred, the connection right. The chain and the wallet belong together
          and belong at the far end — they are the state of the session, not a
          part of the navigation, and they used to sit on a second row where they
          read as a heading for the page rather than as status. */}
      <div className="top" data-ent="fade" data-ent-delay="0">
        <div className={s.bar}>
          <div className={s.barLeft}>
            <span className={s.mark}>{BORROWED}</span>

            <div className={s.tabs} role="tablist" aria-label="Borrow or positions">
              {(["borrow", "positions"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={s.tab}
                  onClick={() => {
                    setTab(id);
                    setPicking(false);
                  }}
                >
                  {id === "borrow" ? "Borrow" : "Positions"}
                  {id === "positions" && openCount > 0 ? <span className={s.pip}>{openCount}</span> : null}
                </button>
              ))}
            </div>
          </div>

          {/* A card-coloured pill on the ground, so it reads as a button without
              competing with the primary action or the active tab. */}
          <a
            className={s.buy}
            href={BUY_URL}
            onClick={(e) => {
              if (isLive(BUY_URL)) return;
              e.preventDefault();
              setSoon(true);
              window.setTimeout(() => setSoon(false), 1800);
            }}
            {...externalLinkProps(BUY_URL)}
          >
            {soon ? "soon." : `Buy ${BORROWED}`}
          </a>

          <div className={s.barRight}>
            <span className={s.chip} data-bad={wallet.wrongNetwork || undefined}>
              <span className={s.dot} aria-hidden="true" />
              Robinhood Chain
            </span>

            {/* Connect lives here as well as on the card. The card's button is
                the end of a form somebody has already started filling in; this
                one is for the visitor who lands on the page and wants to attach a
                wallet before deciding anything. Hidden once connected, where the
                address and the disconnect take its place — the two are the same
                slot in two states, not two controls.

                Nothing renders while `ready` is false: that is wagmi restoring a
                stored session, and offering Connect to somebody who is about to
                appear as connected reads as having been logged out. */}
            {wallet.ready && !wallet.account ? (
              <button
                type="button"
                className={s.connect}
                onClick={wallet.connect}
                disabled={wallet.connecting}
              >
                {wallet.connecting ? "Connecting…" : "Connect"}
              </button>
            ) : null}

            {shortAccount ? <span className={s.addr}>{shortAccount}</span> : null}

            {/* Only when there is something to disconnect. A permanently visible
                log-out next to an empty address is a control for a state the
                visitor is not in.

                The wording is careful: this ends the session between the site and
                the wallet, and wagmi forgets the connection so a reload does not
                silently reattach — but the wallet may still list this site among
                the ones it has permitted, and that is the wallet's to revoke, not
                ours. Saying "log out" without that caveat is a claim the next
                page load can contradict. */}
            {wallet.account ? (
              <button
                type="button"
                className={s.iconBtn}
                onClick={wallet.disconnect}
                aria-label="Disconnect this wallet"
                title="Disconnect. Your wallet may still list this site as permitted — revoke that in the wallet."
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor">
                  <path
                    d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M10 17l5-5-5-5M15 12H3"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ) : null}

            <button
              type="button"
              className={s.iconBtn}
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
      </div>

      {/* ---------------- the deal ---------------- */}
      <div className={`middle ${s.middle}`} data-ent="up" data-ent-delay="240">
        {/* The sheet is a table and wants room; the borrow card is a column and
            does not. One container, two widths. */}
        <div className={s.deal} data-wide={tab === "positions" || undefined}>
          {tab === "borrow" ? (
            <>
              <div className={s.pitch}>
                <h1 className={s.h1}>
                  Lock memes.
                  <br />
                  Borrow <em>{BORROWED}</em>.
                </h1>
                {/* True of this contract, which says so in its own header:
                    "There is no interest and no fees." */}
                <p className={s.terms}>0% interest · no fees</p>
              </div>

              <div className={s.card}>
                {/* --- lock --- */}
                <div className={s.field}>
                  <div className={s.fieldTop}>
                    <label className={s.lbl} htmlFor={lockId}>
                      Lock
                      {balance !== undefined && balance > 0n ? <em> · held</em> : null}
                    </label>
                    <span className={s.sp} />
                    <button
                      type="button"
                      className={s.tokenBtn}
                      onClick={() => setPicking(true)}
                      disabled={collateral.length === 0}
                    >
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

                  <div className={s.entry}>
                    <input
                      id={lockId}
                      /* text + inputmode, not type="number": a number input drops
                         the caret to the end on every reformat and refuses a
                         lone dot. */
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={lock}
                      onChange={(e) => {
                        setLock(e.target.value.replace(/[^0-9.,]/g, ""));
                        setPin("lock");
                      }}
                    />
                  </div>

                  <div className={s.under}>
                    <span>
                      {coin ? formatWeth(valueInWeth(lockWei, coin.decimals, coin.unitWeth)) : "—"}
                    </span>
                    <span className={s.sp} />
                    {balance !== undefined && balance > 0n && coin ? (
                      <div className={s.pcts}>
                        {[25, 50, 75, 100].map((p) => (
                          <button
                            key={p}
                            type="button"
                            className={s.pct}
                            onClick={() => {
                              setLock(exactAmount((balance * BigInt(p)) / 100n, coin.decimals));
                              setPin("lock");
                            }}
                          >
                            {p === 100 ? "Max" : `${p}%`}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className={s.arrow} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M12 5v14M6 13l6 6 6-6" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </div>

                {/* --- borrow --- */}
                <div className={s.field}>
                  <div className={s.fieldTop}>
                    <label className={s.lbl} htmlFor={borrowId}>
                      Borrow
                    </label>
                    <span className={s.sp} />
                    <span className={s.tokenStatic}>{BORROWED}</span>
                  </div>

                  <div className={s.entry}>
                    <input
                      id={borrowId}
                      type="text"
                      inputMode="decimal"
                      placeholder="0"
                      value={borrowValue}
                      onChange={(e) => {
                        setBorrow(e.target.value.replace(/[^0-9.,]/g, ""));
                        setBorrowTouched(true);
                        setPin("borrow");
                      }}
                    />
                  </div>

                  <div className={s.under}>
                    <span>{formatWeth(valueInWeth(borrowWei, cbDecimals, cbUnitWeth))}</span>
                    <span className={s.sp} />
                    {maxBorrowWei > 0n ? (
                      <button
                        type="button"
                        className={s.pct}
                        onClick={() => {
                          setBorrow(exactAmount(maxBorrowWei, cbDecimals));
                          setBorrowTouched(true);
                          setPin("borrow");
                        }}
                      >
                        Max {formatAmount(maxBorrowWei, cbDecimals)} {BORROWED}
                      </button>
                    ) : null}
                  </div>
                </div>

                <Ruler ltv={ltv} onChange={setLtv} interactive label="How much to borrow" />

                <dl className={s.readout}>
                  <div className={s.rd}>
                    <dt>Loan to value</dt>
                    <dd data-tone={tone}>{ltv.toFixed(1)}%</dd>
                  </div>
                  <div className={s.rd}>
                    <dt>Repay</dt>
                    <dd>
                      {formatAmount(borrowWei, cbDecimals)} {BORROWED}
                    </dd>
                  </div>
                </dl>

                {/* The sentence this screen exists for. 72% sounds clear of 90
                    and is not: it means a 20% dip takes everything. */}
                <p className={s.note} data-tone={ltv > 0 ? tone : "calm"}>
                  <b>{ltv > 0 ? riskLabel(risk) : "No loan yet"}</b>
                  {ltv > 0 ? (
                    <>
                      {" · a "}
                      {drop.toFixed(0)}% fall in {coin?.symbol ?? "the coin"} liquidates you, and{" "}
                      <button type="button" className={s.link} onClick={() => setExplaining(true)}>
                        you keep nothing
                      </button>
                      .
                    </>
                  ) : (
                    <> · lock a coin, then say how much {BORROWED} you want.</>
                  )}
                </p>

                {market.error ? <p className={s.problem}>{market.error}</p> : null}
                {blocker ? <p className={s.problem}>{blocker}</p> : null}

                <button
                  type="button"
                  className={`${s.btn} ${s.primary}`}
                  onClick={cta.onClick}
                  disabled={cta.disabled}
                >
                  {cta.label}
                </button>

                {/* The phone-in-a-browser case the RainbowKit modal cannot serve
                    without a WalletConnect project id: open this page inside the
                    wallet app, where injected takes over. Self-hides on desktop
                    and once connected. */}
                {!wallet.account ? <MobileWalletLinks /> : null}

                <TxStatus state={tx.state} onDismiss={tx.reset} />
              </div>
            </>
          ) : (
            <Positions
              market={market.data}
              wallet={wallet}
              positions={positions.data}
              loading={positions.loading}
              error={positions.error}
              theme={theme}
              onChanged={() => {
                positions.refresh();
                market.refresh();
              }}
              onBorrowAgain={() => setTab("borrow")}
            />
          )}
        </div>
      </div>

      {/* ---------------- foot ---------------- */}
      <div className="bottom">
        <div className={s.foot}>
          <button type="button" className={s.footLink} onClick={() => setExplaining(true)}>
            Liquidation
          </button>
          {/* The public token address. Null until the final token exists, so it
              shows "coming soon" and cannot be copied; the moment TOKEN_ADDRESS
              in lib/links.ts holds the real value it becomes the copyable
              address, with no other change. The old interim contract is
              deliberately not shown. */}
          <span className={s.addrRow}>
            {TOKEN_ADDRESS ? (
              <button
                type="button"
                className={s.footLink}
                onClick={copyContract}
                aria-label="Copy the contract address"
              >
                {copied ? "Copied ✓" : `${short(TOKEN_ADDRESS)} · copy`}
              </button>
            ) : (
              <span className={s.addrSoon}>Contract · coming soon</span>
            )}
          </span>
        </div>
        <div className="cue">
          <span>Scroll ↓</span>
        </div>
      </div>

      {/* ---------------- popups ---------------- */}

      <Modal theme={theme} open={picking} onClose={() => setPicking(false)} title="Choose collateral">
        {/* Every row here is a token `collateralTokens()` returned. The roster in
            `protocol/tokens.ts` no longer contributes rows of its own — it is
            consulted for the running order, the display name and the colour, all
            of which a token contract cannot answer, and nothing else.

            That is the difference between a list that is read and a list that is
            merely checked against one: a coin the admin whitelists appears here
            without this page changing, and a coin the design knows about but the
            contract has never heard of does not appear at all. */}
        {market.loading && collateral.length === 0 ? (
          <p className={s.mnote}>Reading the collateral list from the contract…</p>
        ) : collateral.length === 0 ? (
          <p className={s.mnote}>
            The contract is not accepting any collateral yet. Nothing can be borrowed against until
            an admin whitelists a coin — when one is, it appears here on its own.
          </p>
        ) : (
          <ul className={s.tokens}>
            {collateral.map((c) => (
              <li key={c.address}>
                <button
                  type="button"
                  className={s.tok}
                  /* Listed but not selectable when the contract has closed it to
                     new loans. It still has to be visible: repaying and adding
                     collateral against a disabled coin must stay reachable. */
                  disabled={!c.enabled}
                  aria-current={c.address === coin?.address || undefined}
                  onClick={() => {
                    setChosen(c.address);
                    setPicking(false);
                  }}
                >
                  <span className={s.dotBig} style={{ background: c.bg, color: c.on }}>
                    {c.symbol.slice(0, 1)}
                  </span>
                  <span className={s.tokName}>
                    <b>{c.symbol}</b>
                    <small>{c.enabled ? c.name : `${c.name} — closed to new loans`}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className={s.mnote}>
          Robinhood Chain memecoins, read from the contract. The list changes when the contract does,
          without this page changing.
        </p>
      </Modal>

      <Modal
        theme={theme}
        open={explaining}
        onClose={() => setExplaining(false)}
        title="How liquidation works"
      >
        <dl className={s.terms2}>
          <div>
            <dt>You may borrow up to</dt>
            <dd>{MAX_LTV}% of what you lock</dd>
          </div>
          <div>
            <dt>You are liquidated at</dt>
            <dd data-tone="danger">{LIQ_LTV}%</dd>
          </div>
          <div>
            <dt>How much is sold</dt>
            <dd data-tone="danger">All of it</dd>
          </div>
        </dl>
        <p className={s.mnote}>
          This is harsher than most lending. There is no partial liquidation and no grace: once the
          ratio touches {LIQ_LTV}%, the whole position is sold to clear the debt, and whatever it
          fetches above the debt goes to the keeper who cleared it, not to you. Adding collateral or
          repaying is allowed at any time, including past the {MAX_LTV}% limit — those two only ever
          improve your position, so they are never blocked.
        </p>
      </Modal>
    </section>
  );
}
