"use client";

import { useState } from "react";
import { lendingAbi } from "@/lib/abi";
import { DEPLOYMENT, publicClient } from "@/lib/chain";
import { healthLabel, healthOf } from "@/lib/health";
import {
  exactAmount,
  formatAmount,
  ltvPercent,
  parseAmount,
  useTokenBalance,
  type Market,
  type Position,
} from "@/lib/protocol";
import { approvalStep, useTx, type Step } from "@/lib/tx";
import type { Wallet } from "@/lib/wallet";
import { BORROWED } from "./tokens";
import { Ruler } from "./Ruler";
import { TxStatus } from "./TxStatus";
import s from "./Positions.module.css";

/**
 * Open loans, and the four things that can be done to one.
 *
 * The rule this component exists to keep, from `public/design/`: **repaying and
 * adding collateral are never blocked.** The 80% cap belongs to borrowing and
 * withdrawing; the other two only ever improve a position, and the contract
 * allows them at any ratio — including past 90%, when they are the only thing
 * standing between the owner and a liquidation that takes everything. So no
 * action here is disabled on health, and the two safe ones are listed first.
 *
 * What refuses a bad withdrawal is the simulate inside the step, which returns
 * the contract's own `LtvTooHigh` with the real figure in it. Guessing the limit
 * in the UI instead would put a second risk rule beside `healthOf` — which is
 * the other thing the handover notes forbid.
 */

type Action = "repay" | "add" | "withdraw" | "borrow";

const ACTIONS: { id: Action; label: string; safe: boolean }[] = [
  { id: "repay", label: "Repay", safe: true },
  { id: "add", label: "Add collateral", safe: true },
  { id: "withdraw", label: "Withdraw", safe: false },
  { id: "borrow", label: "Borrow more", safe: false },
];

export function Positions({
  market,
  wallet,
  positions,
  loading,
  error,
  onChanged,
}: {
  market?: Market;
  wallet: Wallet;
  positions?: Position[];
  loading: boolean;
  error?: string;
  onChanged: () => void;
}) {
  if (!wallet.ready) return null;

  if (!wallet.account) {
    return (
      <div className={s.empty}>
        <p className={s.emptyTitle}>Nothing to show yet</p>
        <p className={s.emptyBody}>
          Connect a wallet and any loans it holds appear here, each with its own ruler on the
          same 0–100 scale as the borrow form.
        </p>
        {wallet.hasProvider ? (
          <button type="button" className={s.ghost} onClick={wallet.connect}>
            Connect wallet
          </button>
        ) : null}
      </div>
    );
  }

  if (error) return <p className={s.problem}>{error}</p>;
  if (loading && !positions) return <p className={s.muted}>Reading the chain…</p>;

  if (!positions?.length) {
    return (
      <div className={s.empty}>
        <p className={s.emptyTitle}>No open loans</p>
        <p className={s.emptyBody}>
          This wallet has nothing borrowed against it. Open one on the Borrow tab and it shows
          up here.
        </p>
      </div>
    );
  }

  return (
    <ul className={s.list}>
      {positions.map((p) => (
        <PositionRow
          key={p.id.toString()}
          position={p}
          market={market}
          wallet={wallet}
          onChanged={onChanged}
        />
      ))}
    </ul>
  );
}

function PositionRow({
  position,
  market,
  wallet,
  onChanged,
}: {
  position: Position;
  market?: Market;
  wallet: Wallet;
  onChanged: () => void;
}) {
  const [action, setAction] = useState<Action>();
  const [amount, setAmount] = useState("");
  const { state, send, reset } = useTx();

  const coin = market?.collateral.find(
    (c) => c.address.toLowerCase() === position.cToken.toLowerCase()
  );
  const collDecimals = coin?.decimals ?? 18;
  const cbDecimals = market?.cbDecimals ?? 18;
  const ltv = ltvPercent(position.ltvBps);
  const health = healthOf(ltv);

  // The token the chosen action moves, which is what the Max button and the
  // decimals below have to agree with.
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
        // over-payment to the debt, but a Max it cannot afford still reverts in
        // safeTransferFrom, so offer the smaller of the two.
        walletBalance !== undefined && walletBalance < position.debtCB
        ? walletBalance
        : position.debtCB
      : action === "add"
        ? walletBalance
        : action === "withdraw"
          ? position.collateralAmount
          : undefined;

  const value = parseAmount(amount, decimals);
  const busy = state.phase === "signing" || state.phase === "pending";

  const submit = async () => {
    if (!wallet.walletClient || !wallet.account || !coin || value <= 0n) return;
    const client = wallet.walletClient;
    const account = wallet.account;
    const lending = { address: DEPLOYMENT.lending, abi: lendingAbi } as const;

    const write = (label: string, functionName: "repay" | "addCollateral" | "withdrawCollateral" | "borrowCB"): Step => ({
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
    } else if (action === "borrow") {
      steps = [write("Borrowing", "borrowCB")];
    }

    const ok = await send(steps);
    if (ok) {
      setAmount("");
      setAction(undefined);
      onChanged();
    }
  };

  return (
    <li className={s.row}>
      <div className={s.head}>
        <span className={s.dot} style={{ background: coin?.bg, color: coin?.on }}>
          {coin?.symbol.slice(0, 1) ?? "?"}
        </span>
        <b className={s.sym}>{coin?.symbol ?? "Unknown coin"}</b>
        <span className={s.id}>#{position.id.toString()}</span>
        <span className={s.state} data-health={health}>
          {ltv.toFixed(2)}% · {healthLabel(health)}
        </span>
      </div>

      <dl className={s.figs}>
        <div>
          <dt>Locked</dt>
          <dd>
            {formatAmount(position.collateralAmount, collDecimals)} {coin?.symbol ?? ""}
          </dd>
        </div>
        <div>
          <dt>Owed</dt>
          <dd>
            {formatAmount(position.debtCB, cbDecimals)} {BORROWED}
          </dd>
        </div>
      </dl>

      <Ruler ltv={ltv} />

      <div className={s.actions}>
        {ACTIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`${s.action} ${action === a.id ? s.actionOn : ""}`}
            data-safe={a.safe}
            onClick={() => {
              setAction(action === a.id ? undefined : a.id);
              setAmount("");
              reset();
            }}
          >
            {a.label}
          </button>
        ))}
      </div>

      {action ? (
        <div className={s.form}>
          <div className={s.field}>
            <input
              className={s.amount}
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              aria-label={`Amount to ${action}`}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
            />
            <span className={s.unit}>{symbol}</span>
            {max !== undefined ? (
              <button
                type="button"
                className={s.max}
                onClick={() => setAmount(exactAmount(max, decimals))}
              >
                Max
              </button>
            ) : null}
          </div>
          <button type="button" className={s.confirm} onClick={submit} disabled={busy || value <= 0n}>
            {busy ? "Working…" : ACTIONS.find((a) => a.id === action)?.label}
          </button>
        </div>
      ) : null}

      <TxStatus state={state} onDismiss={reset} />
    </li>
  );
}
