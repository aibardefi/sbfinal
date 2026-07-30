"use client";

import { useMemo, useState } from "react";
import { DEPLOYMENT, publicClient } from "@/lib/chain";
import { lendingAbi } from "@/lib/abi";
import { UI_MAX_LTV, dropToLiquidation, riskLabel, riskOf, riskTone } from "@/lib/health";
import {
  exactAmount,
  formatAmount,
  formatWeth,
  ltvPercentFor,
  parseAmount,
  useTokenBalance,
  valueInWeth,
  type Market,
  type Position,
} from "@/lib/protocol";
import { approvalStep, useTx, type Step } from "@/lib/tx";
import type { Wallet } from "@/lib/wallet";
import { BORROWED } from "./tokens";
import { Modal } from "./Modal";
import { Ruler } from "./Ruler";
import { TxStatus } from "./TxStatus";
import s from "./Positions.module.css";

/**
 * Open loans, as the design's sheet, and the Manage popup that acts on one.
 *
 * The rule this component exists to keep, from `public/design/`: **repaying and
 * adding collateral are never blocked.** The 80% cap belongs to borrowing and
 * withdrawing; the other two only ever improve a position, and the contract
 * allows them at any ratio — including past 90%, when they are the only thing
 * between the owner and a liquidation that takes everything. So no action here
 * is disabled on health, and the two safe ones are listed first.
 *
 * What refuses a bad withdrawal is the simulate inside the step, which returns
 * the contract's own `LtvTooHigh` with the real figure in it. Guessing the limit
 * in the UI instead would put a second risk rule beside `riskOf`.
 *
 * The design's "Finished" sub-tab is not built. `positionsOf` returns open loans
 * only — the contract deletes a position when it closes — so a history needs
 * `PositionOpened` + `PositionClosed` + `Liquidated` logs replayed from
 * `deployBlock`. It is worth doing, because today a liquidated loan simply
 * vanishes and the borrower finds out by noticing it is gone.
 */

type Action = "repay" | "add" | "withdraw" | "borrow";

/* The design's order, and it is not alphabetical or arbitrary: the two that can
   only improve a position sit at the ends, and the two the 80% cap applies to
   are in the middle. Repay is last because it is the default and the eye lands
   on the selected one. */
const ACTIONS: { id: Action; label: string; safe: boolean }[] = [
  { id: "add", label: "Add", safe: true },
  { id: "withdraw", label: "Withdraw", safe: false },
  { id: "borrow", label: "Borrow", safe: false },
  { id: "repay", label: "Repay", safe: true },
];

export function Positions({
  market,
  wallet,
  positions,
  loading,
  error,
  theme,
  onChanged,
  onBorrowAgain,
}: {
  market?: Market;
  wallet: Wallet;
  positions?: Position[];
  loading: boolean;
  error?: string;
  theme: "light" | "dark";
  onChanged: () => void;
  onBorrowAgain: () => void;
}) {
  const [managing, setManaging] = useState<bigint>();

  /* Memoised: the `?? []` would otherwise mint a new array on every render
     while the positions are still loading, and the totals below would recompute
     forever. */
  const rows = useMemo(() => positions ?? [], [positions]);
  const open = rows.length;

  const totals = useMemo(() => {
    let locked = 0n;
    let debt = 0n;
    for (const p of rows) {
      const coin = market?.collateral.find(
        (c) => c.address.toLowerCase() === p.cToken.toLowerCase()
      );
      if (coin) locked += valueInWeth(p.collateralAmount, coin.decimals, coin.unitWeth);
      if (market) debt += valueInWeth(p.debtCB, market.cbDecimals, market.cbUnitWeth);
    }
    return { locked, debt };
  }, [rows, market]);

  if (!wallet.ready) return null;

  if (!wallet.account) {
    return (
      <div className={s.sheet}>
        <div className={s.center}>
          <h2>Nothing to show yet</h2>
          <p>
            Connect a wallet and any loans it holds appear here, each on the same 0–100 ruler as the
            borrow form.
          </p>
          {wallet.hasProvider ? (
            <button type="button" className={s.ghost} onClick={wallet.connect}>
              Connect wallet
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (error) return <p className={s.problem}>{error}</p>;
  if (loading && !positions) return <p className={s.muted}>Reading the chain…</p>;

  if (!open) {
    return (
      <div className={s.sheet}>
        <div className={s.center}>
          <h2>No open loans</h2>
          <p>This wallet has nothing borrowed against it.</p>
          <button type="button" className={s.ghost} onClick={onBorrowAgain}>
            Borrow {BORROWED}
          </button>
        </div>
      </div>
    );
  }

  const active = rows.find((p) => p.id === managing);

  return (
    <div className={s.sheet}>
      {/* The design has Open / Finished here. Only Open exists — see the note at
          the top of this file — so this states the count rather than offering a
          second tab that would open on nothing. */}
      <div className={s.pshead}>
        <span className={s.subtab}>
          Open <span className={s.pip}>{open}</span>
        </span>
      </div>

      {/* Column names, wide layout only — see the media query in the stylesheet.
          On a narrow screen each row labels itself and a header would be a row
          of words with nothing under them. */}
      <div className={s.colhead} aria-hidden="true">
        <span>ID</span>
        <span>Locked</span>
        <span>Debt</span>
        <span>LTV</span>
        <span>0 — 80 — 90</span>
        <span />
      </div>

      <ul className={s.list}>
        {rows.map((p) => (
          <Row key={p.id.toString()} position={p} market={market} onManage={() => setManaging(p.id)} />
        ))}
      </ul>

      <div className={s.tally}>
        <span>
          {open} open · {formatWeth(totals.locked)} locked · {formatWeth(totals.debt)} owed
        </span>
        <span className={s.sp} />
        <button type="button" className={s.tallyLink} onClick={onBorrowAgain}>
          Borrow again
        </button>
      </div>

      {active && market ? (
        <Manage
          key={active.id.toString()}
          position={active}
          market={market}
          wallet={wallet}
          theme={theme}
          onClose={() => setManaging(undefined)}
          onDone={() => {
            setManaging(undefined);
            onChanged();
          }}
        />
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   One row
   --------------------------------------------------------------------------- */

function Row({
  position,
  market,
  onManage,
}: {
  position: Position;
  market?: Market;
  onManage: () => void;
}) {
  const coin = market?.collateral.find(
    (c) => c.address.toLowerCase() === position.cToken.toLowerCase()
  );
  const collDecimals = coin?.decimals ?? 18;
  const cbDecimals = market?.cbDecimals ?? 18;
  const ltv = Number(position.ltvBps) / 100;
  const risk = riskOf(ltv);
  const tone = riskTone(risk);
  /* The one action worth putting in front of somebody at a glance. Everything
     else lives behind Manage; this is the one that stops a liquidation. */
  const urgent = risk === "high";

  return (
    <li className={s.row}>
      <span className={s.pid}>#{position.id.toString()}</span>

      <div className={s.locked}>
        <b>
          {formatAmount(position.collateralAmount, collDecimals)} {coin?.symbol ?? "?"}
        </b>
        <small>
          {coin ? formatWeth(valueInWeth(position.collateralAmount, collDecimals, coin.unitWeth)) : "—"}
        </small>
      </div>

      <div className={s.debt}>
        <b>
          {formatAmount(position.debtCB, cbDecimals)} {BORROWED}
        </b>
        <small>
          {market ? formatWeth(valueInWeth(position.debtCB, cbDecimals, market.cbUnitWeth)) : "—"}
        </small>
      </div>

      <div className={s.ltvCell}>
        <span className={s.pltv} data-tone={tone}>
          {ltv.toFixed(1)}%
        </span>
        {/* The word, always, beside the colour. The design leaves a bare red
            number here, which is a state you cannot read without seeing red. */}
        <small className={s.riskWord} data-tone={tone}>
          {riskLabel(risk)}
        </small>
      </div>

      {/* No legend on these: the notches repeat on every row and the words would
          too. The column header says the scale once. */}
      <div className={s.rulerCell}>
        <Ruler ltv={ltv} scale={false} />
      </div>

      <button
        type="button"
        className={urgent ? `${s.action} ${s.actionHot}` : s.action}
        onClick={onManage}
      >
        {urgent ? "Repay now" : "Manage"}
      </button>

      {/* The full sentence only where there is room for it. On the wide layout
          the risk word above carries the same state in one column. */}
      <p className={s.rowRisk} data-tone={tone}>
        {riskLabel(risk)} · a {dropToLiquidation(ltv).toFixed(0)}% fall in {coin?.symbol ?? "the coin"}{" "}
        liquidates you.
      </p>
    </li>
  );
}

/* ---------------------------------------------------------------------------
   Manage
   --------------------------------------------------------------------------- */

function Manage({
  position,
  market,
  wallet,
  theme,
  onClose,
  onDone,
}: {
  position: Position;
  market: Market;
  wallet: Wallet;
  theme: "light" | "dark";
  onClose: () => void;
  onDone: () => void;
}) {
  const [action, setAction] = useState<Action>("repay");
  const [amount, setAmount] = useState("");
  const { state, send, reset } = useTx();

  const coin = market.collateral.find(
    (c) => c.address.toLowerCase() === position.cToken.toLowerCase()
  );
  const collDecimals = coin?.decimals ?? 18;
  const cbDecimals = market.cbDecimals;

  const inCB = action === "repay" || action === "borrow";
  const decimals = inCB ? cbDecimals : collDecimals;
  const symbol = inCB ? BORROWED : (coin?.symbol ?? "");

  const walletBalance = useTokenBalance(
    action === "add" ? coin?.address : action === "repay" ? DEPLOYMENT.cb : undefined,
    wallet.account
  );

  const max =
    action === "repay"
      ? // Clamped to the wallet, not just the debt: the contract clamps an
        // over-payment down to the debt, but a Max the wallet cannot afford
        // still reverts inside safeTransferFrom, so offer the smaller of the two.
        walletBalance !== undefined && walletBalance < position.debtCB
        ? walletBalance
        : position.debtCB
      : action === "add"
        ? walletBalance
        : action === "withdraw"
          ? position.collateralAmount
          : undefined;

  const value = parseAmount(amount, decimals);

  // --- what the position looks like afterwards ------------------------------

  const nextCollateral =
    action === "add"
      ? position.collateralAmount + value
      : action === "withdraw"
        ? position.collateralAmount > value
          ? position.collateralAmount - value
          : 0n
        : position.collateralAmount;

  const paid = value > position.debtCB ? position.debtCB : value;
  const nextDebt =
    action === "borrow"
      ? position.debtCB + value
      : action === "repay"
        ? position.debtCB - paid
        : position.debtCB;

  const ltvNow = Number(position.ltvBps) / 100;
  const ltvNext = coin
    ? ltvPercentFor(nextCollateral, nextDebt, coin, cbDecimals, market.cbUnitWeth)
    : 0;
  const closes = action === "repay" && value > 0n && nextDebt === 0n;
  const toneNext = riskTone(riskOf(ltvNext));

  const busy = state.phase === "signing" || state.phase === "pending";
  const overCap = (action === "withdraw" || action === "borrow") && ltvNext > UI_MAX_LTV;

  const submit = async () => {
    if (!wallet.walletClient || !wallet.account || !coin || value <= 0n) return;
    const client = wallet.walletClient;
    const account = wallet.account;
    const lending = { address: DEPLOYMENT.lending, abi: lendingAbi } as const;

    const write = (
      label: string,
      functionName: "repay" | "addCollateral" | "withdrawCollateral" | "borrowCB"
    ): Step => ({
      label,
      run: async () => {
        const { request } = await publicClient.simulateContract({
          account,
          ...lending,
          functionName,
          args: [position.id, value],
        });
        return client.writeContract(request);
      },
    });

    let steps: Step[] = [];
    if (action === "repay") {
      steps = [
        ...(await approvalStep(client, account, DEPLOYMENT.cb, BORROWED, value)),
        write("Repaying", "repay"),
      ];
    } else if (action === "add") {
      steps = [
        ...(await approvalStep(client, account, coin.address, coin.symbol, value)),
        write("Adding collateral", "addCollateral"),
      ];
    } else if (action === "withdraw") {
      steps = [write("Withdrawing", "withdrawCollateral")];
    } else {
      steps = [write("Borrowing", "borrowCB")];
    }

    if (await send(steps)) onDone();
  };

  const cta = closes
    ? `Repay in full & close #${position.id}`
    : action === "add"
      ? "Add collateral"
      : action === "withdraw"
        ? "Withdraw"
        : action === "borrow"
          ? "Borrow more"
          : "Repay";

  const explain = closes
    ? `Clears the debt. ${formatAmount(position.collateralAmount, collDecimals)} ${coin?.symbol ?? ""} returns and #${position.id} closes.`
    : action === "add"
      ? "More collateral, same debt. Always allowed, at any ratio."
      : action === "withdraw"
        ? "Takes collateral back out. The position must stay under the limit afterwards."
        : action === "borrow"
          ? "More debt against the same collateral."
          : "Pays down part of the debt. Always allowed, at any ratio.";

  return (
    <Modal theme={theme} open onClose={onClose} title={`Position #${position.id}`}>
      <div className={s.seg} role="tablist" aria-label="What to do with this position">
        {ACTIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={action === a.id}
            className={s.segBtn}
            onClick={() => {
              setAction(a.id);
              setAmount("");
              reset();
            }}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className={s.mfield}>
        <div className={s.mfieldTop}>
          <span className={s.lbl}>{ACTIONS.find((a) => a.id === action)?.label}</span>
          <span className={s.sp} />
          <span className={s.tokenStatic}>{symbol}</span>
        </div>
        <input
          className={s.mamount}
          type="text"
          inputMode="decimal"
          placeholder="0"
          aria-label={`Amount to ${action}`}
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
        />
        <div className={s.under}>
          <span>
            {inCB
              ? formatWeth(valueInWeth(value, cbDecimals, market.cbUnitWeth))
              : coin
                ? formatWeth(valueInWeth(value, collDecimals, coin.unitWeth))
                : "—"}
          </span>
          <span className={s.sp} />
          {max !== undefined && max > 0n ? (
            <div className={s.pcts}>
              {[25, 50, 75, 100].map((p) => (
                <button
                  key={p}
                  type="button"
                  className={s.pct}
                  onClick={() => setAmount(exactAmount((max * BigInt(p)) / 100n, decimals))}
                >
                  {p === 100 ? "Max" : `${p}%`}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className={s.after}>
        <span className={s.lbl}>After this</span>
        <Ruler ltv={value > 0n ? ltvNext : ltvNow} />

        <dl className={s.readout}>
          <div className={s.rd}>
            <dt>Loan to value</dt>
            <dd>
              {value > 0n ? (
                <span className={s.delta}>
                  <span className={s.was}>{ltvNow.toFixed(1)}%</span>
                  <span aria-hidden="true">→</span>
                  <span data-tone={toneNext}>{ltvNext.toFixed(1)}%</span>
                </span>
              ) : (
                `${ltvNow.toFixed(1)}%`
              )}
            </dd>
          </div>
          <div className={s.rd}>
            <dt>Locked</dt>
            <dd>
              {value > 0n && nextCollateral !== position.collateralAmount ? (
                <span className={s.delta}>
                  <span className={s.was}>{formatAmount(position.collateralAmount, collDecimals)}</span>
                  <span aria-hidden="true">→</span>
                  <span>
                    {formatAmount(nextCollateral, collDecimals)} {coin?.symbol ?? ""}
                  </span>
                </span>
              ) : (
                `${formatAmount(position.collateralAmount, collDecimals)} ${coin?.symbol ?? ""}`
              )}
            </dd>
          </div>
          <div className={s.rd}>
            <dt>Debt</dt>
            <dd>
              {value > 0n && nextDebt !== position.debtCB ? (
                <span className={s.delta}>
                  <span className={s.was}>{formatAmount(position.debtCB, cbDecimals)}</span>
                  <span aria-hidden="true">→</span>
                  <span>
                    {formatAmount(nextDebt, cbDecimals)} {BORROWED}
                  </span>
                </span>
              ) : (
                `${formatAmount(position.debtCB, cbDecimals)} ${BORROWED}`
              )}
            </dd>
          </div>
        </dl>

        <p className={s.note} data-tone={closes ? "safe" : overCap ? "danger" : "calm"}>
          {overCap
            ? `That would leave the position at ${ltvNext.toFixed(1)}%, over the ${UI_MAX_LTV}% limit. The contract will refuse it.`
            : explain}
        </p>
      </div>

      <button
        type="button"
        className={`${s.btn} ${s.primary}`}
        onClick={submit}
        disabled={busy || value <= 0n}
      >
        {busy ? "Working…" : cta}
      </button>

      <TxStatus state={state} onDismiss={reset} />
    </Modal>
  );
}
