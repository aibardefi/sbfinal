"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BaseError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
  formatUnits,
  parseUnits,
  type Address,
} from "viem";
import { erc20Abi, lendingAbi } from "./abi";
import { DEPLOYMENT, publicClient } from "./chain";
import { coinColour, rosterEntry, rosterIndex } from "@/components/protocol/tokens";
import { MAX_LTV } from "./health";

/**
 * Everything the borrow screen reads from CBLending, and the arithmetic that
 * turns a ratio on a ruler into an amount the contract will accept.
 *
 * The screen holds no list of coins, no price and no inventory figure of its
 * own. `collateralTokens()` is the roster, `collateralConfigs()` says which of
 * them may still be borrowed against, and `quoteCollateralInWeth` /
 * `quoteCBInWeth` are the same TWAP reads `_positionLtv` uses to decide whether
 * a borrow reverts. Anything computed from a different source is a second
 * opinion the contract has not agreed to.
 */

export type CollateralToken = {
  address: Address;
  /** The roster's ticker where there is one, otherwise the token's own. */
  symbol: string;
  /** What `symbol()` actually returned. Recorded, not displayed. */
  onChainSymbol: string;
  name: string;
  decimals: number;
  /** Gates opening and borrowing only. A disabled token still appears, because
      repaying and adding collateral against it must stay reachable. */
  enabled: boolean;
  minCollateral: bigint;
  /** What one whole token is worth in WETH wei, from the contract's own TWAP.
      Carried on the token so every row can price itself without another read. */
  unitWeth: bigint;
  bg: string;
  on: string;
};

export type Market = {
  cbDecimals: number;
  /**
   * What the lent token calls itself on chain.
   *
   * Read and kept rather than assumed. It now answers `CB` ("cyka blyat"), so it
   * agrees with the `$CB` the site writes — but the deployment before this one
   * answered `WN` ("Wewen") while the screen still said $CB, and the only reason
   * that was discoverable was this field. It stays for the next time the two
   * drift apart.
   */
  cbSymbol: string;
  /** What one whole $CB is worth in WETH wei. */
  cbUnitWeth: bigint;
  available: bigint;
  paused: boolean;
  collateral: CollateralToken[];
};

export type Position = {
  id: bigint;
  cToken: Address;
  collateralAmount: bigint;
  debtCB: bigint;
  ltvBps: bigint;
};

const lending = { address: DEPLOYMENT.lending, abi: lendingAbi } as const;

/** One whole token, as an integer. */
const unit = (decimals: number) => 10n ** BigInt(decimals);

async function readMetadata(address: Address) {
  // Settled, not `all`: one token with a bytes32 symbol must not blank the list.
  const [symbol, name, decimals] = await Promise.allSettled([
    publicClient.readContract({ address, abi: erc20Abi, functionName: "symbol" }),
    publicClient.readContract({ address, abi: erc20Abi, functionName: "name" }),
    publicClient.readContract({ address, abi: erc20Abi, functionName: "decimals" }),
  ]);
  return {
    symbol: symbol.status === "fulfilled" ? symbol.value : "???",
    name: name.status === "fulfilled" ? name.value : "Unknown token",
    // 18 is the safe guess only for display; every amount below is computed from
    // whatever this returns, so a token that fails this read is one we cannot
    // size a loan for. It stays in the list, disabled by the contract or not.
    decimals: decimals.status === "fulfilled" ? Number(decimals.value) : 18,
  };
}

export async function loadMarket(): Promise<Market> {
  const [tokens, available, paused, rawCbDecimals, cbSymbol] = await Promise.all([
    publicClient.readContract({ ...lending, functionName: "collateralTokens" }),
    publicClient.readContract({ ...lending, functionName: "availableCB" }),
    publicClient.readContract({ ...lending, functionName: "paused" }),
    publicClient.readContract({ address: DEPLOYMENT.cb, abi: erc20Abi, functionName: "decimals" }),
    publicClient
      .readContract({ address: DEPLOYMENT.cb, abi: erc20Abi, functionName: "symbol" })
      .catch(() => "???"),
  ]);
  const cbDecimals = Number(rawCbDecimals);
  const cbUnitWeth = await publicClient.readContract({
    ...lending,
    functionName: "quoteCBInWeth",
    args: [unit(cbDecimals)],
  });

  const collateral = (
    await Promise.all(
      tokens.map(async (address): Promise<CollateralToken> => {
        const [meta, cfg] = await Promise.all([
          readMetadata(address),
          publicClient.readContract({ ...lending, functionName: "collateralConfigs", args: [address] }),
        ]);
        const [, , enabled, minCollateralAmount] = cfg;
        /* Priced here, once per refresh, rather than on demand per keystroke.
           `quoteAtTick` is a mulDiv and so linear in the amount, which is what
           makes a unit price scalable to any amount locally — the alternative
           was an RPC round trip for every pixel of the ruler. */
        const unitWeth = await publicClient
          .readContract({
            ...lending,
            functionName: "quoteCollateralInWeth",
            args: [address, unit(meta.decimals)],
          })
          // A token the oracle will not price is still listed, still repayable,
          // and simply has no value to show. Zero is the "unknown" here and
          // every caller treats it as such rather than as "worthless".
          .catch(() => 0n);
        const listed = rosterEntry(meta.symbol);
        return {
          address,
          ...meta,
          /* The roster wins over the token where the design has an opinion, for
             the ticker as well as the name. On this deployment the chain says
             LITTLEJOHN, CashDog, TENDIES and YOLO; the design says JOHN,
             CASHDOG, Tendies and Yolo. The address is the identity — the ticker
             is copy, and the chain is not where copy is decided. */
          symbol: listed?.sym ?? meta.symbol,
          name: listed?.name ?? meta.name,
          /** What the token itself answers, kept for the record. */
          onChainSymbol: meta.symbol,
          enabled,
          minCollateral: minCollateralAmount,
          unitWeth,
          ...coinColour(meta.symbol),
        };
      })
    )
  ).sort((a, b) => rosterIndex(a.symbol) - rosterIndex(b.symbol));

  return { cbDecimals, cbSymbol, cbUnitWeth, available, paused, collateral };
}

/**
 * What an amount of a token is worth, in WETH wei.
 *
 * WETH and not dollars. The contract prices everything through Uniswap TWAPs
 * against WETH and there is no USD feed anywhere in it, so the sub-values under
 * each field are denominated in the unit the protocol actually thinks in. The
 * design prototype shows "$ 15,398" there; a dollar figure on this page would be
 * a number nothing on chain could be held to.
 */
export const valueInWeth = (amount: bigint, decimals: number, unitWeth: bigint) =>
  unitWeth <= 0n ? 0n : (amount * unitWeth) / unit(decimals);

/**
 * The ratio the contract would compute for a hypothetical position, as a
 * percentage.
 *
 * Scaled from unit prices rather than quoting each amount: `quoteAtTick` is a
 * `mulDiv` and so linear in the amount, which is the difference between a ruler
 * that moves and one that fires an RPC call per pixel. Returns 0 with no debt
 * and 0 with no collateral value — the caller has nothing to draw either way.
 */
export function ltvPercentFor(
  collateralWei: bigint,
  borrowWei: bigint,
  token: Pick<CollateralToken, "decimals" | "unitWeth">,
  cbDecimals: number,
  cbUnitWeth: bigint
): number {
  const coll = valueInWeth(collateralWei, token.decimals, token.unitWeth);
  const debt = valueInWeth(borrowWei, cbDecimals, cbUnitWeth);
  if (coll <= 0n || debt <= 0n) return 0;
  // Through Number only at the end, on a ratio that is at most a few hundred.
  return Number((debt * 1_000_000n) / coll) / 10_000;
}

/**
 * The two directions the ruler can push, given which field the visitor pinned.
 *
 * Whichever amount was typed last is held and the other one moves — because LTV
 * is a ratio, so dragging it can only change one side, and which side depends on
 * whether you arrived saying "I am locking this much" or "I want this much $CB".
 *
 * Both legs round in the borrower's favour by accident of the contract's own
 * rounding — collateral value is quoted down, $CB value up — so a borrow sized
 * here lands under what the contract computes, never over. `UI_MAX_LTV` leaves
 * the headroom and the simulate before the write is what actually proves it.
 */
export function borrowForLtv(
  collateralWei: bigint,
  ltv: number,
  token: Pick<CollateralToken, "decimals" | "unitWeth">,
  cbDecimals: number,
  cbUnitWeth: bigint
): bigint {
  if (collateralWei <= 0n || cbUnitWeth <= 0n) return 0n;
  const coll = valueInWeth(collateralWei, token.decimals, token.unitWeth);
  const targetDebtWeth = (coll * BigInt(Math.round(ltv * 100))) / 10_000n;
  return (targetDebtWeth * unit(cbDecimals)) / cbUnitWeth;
}

export function collateralForLtv(
  borrowWei: bigint,
  ltv: number,
  token: Pick<CollateralToken, "decimals" | "unitWeth">,
  cbDecimals: number,
  cbUnitWeth: bigint
): bigint {
  if (borrowWei <= 0n || ltv <= 0 || token.unitWeth <= 0n) return 0n;
  const debt = valueInWeth(borrowWei, cbDecimals, cbUnitWeth);
  const neededCollWeth = (debt * 10_000n) / BigInt(Math.round(ltv * 100));
  return (neededCollWeth * unit(token.decimals)) / token.unitWeth;
}

/** The inverse, for reading a position back: what its debt is worth as a ratio. */
export function ltvPercent(ltvBps: bigint) {
  return Number(ltvBps) / 100;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

type Loaded<T> = { data?: T; error?: string; loading: boolean; refresh: () => void };

/**
 * One result, stamped with the key it was fetched for.
 *
 * Every hook below stores this shape rather than a bare value, and reads it back
 * only when the stamp still matches what is being asked for now. That is what
 * makes a stale answer unreachable instead of merely unlikely: switch coin and
 * the previous coin's prices are not "about to be replaced", they are already
 * not being returned — so a borrow amount can never be computed from the price
 * of a coin the visitor is no longer locking.
 *
 * It also keeps `loading` derived. A separate loading flag set at the top of an
 * effect is a synchronous state write during render's commit, which React 19
 * flags for good reason; `!current` says the same thing and cannot fall out of
 * step with the data it describes.
 */
type Stamped<T> = { key: string; data?: T; error?: string };

const settled = <T,>(entry: Stamped<T> | undefined, key: string | undefined) =>
  entry && key && entry.key === key ? entry : undefined;

/**
 * The market, refreshed on a timer.
 *
 * 30 seconds against a 60-second TWAP window: fast enough that a price cannot
 * move a whole window without the screen noticing, slow enough not to hammer a
 * public endpoint from a page people leave open.
 */
export function useMarket(): Loaded<Market> {
  const [entry, setEntry] = useState<Stamped<Market>>();
  const [tick, setTick] = useState(0);
  const key = `market:${tick}`;

  useEffect(() => {
    let live = true;
    loadMarket()
      .then((data) => live && setEntry({ key, data }))
      .catch(() => live && setEntry({ key, error: "Could not reach Robinhood Chain." }));
    return () => {
      live = false;
    };
  }, [key]);

  useEffect(() => {
    // A hidden tab has nobody watching the figures, so it does not poll — that is
    // just heat on a public RPC. Returning to the tab refreshes once, because the
    // numbers it is showing went stale while it was away.
    const id = window.setInterval(() => {
      if (!document.hidden) setTick((t) => t + 1);
    }, 30_000);
    const onVisible = () => {
      if (!document.hidden) setTick((t) => t + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  /* Held across a refresh on purpose: the 30-second poll must not blank the
     figures every half minute. Only the very first load shows nothing. */
  const current = settled(entry, key) ?? entry;
  return {
    data: current?.data,
    error: current?.error,
    loading: !current,
    refresh: useCallback(() => setTick((t) => t + 1), []),
  };
}

/* usePrices is gone. Unit prices now ride on the market refresh — see
   loadMarket — because the redesigned screen prices four things at once (both
   fields, every position row and the Max) and a per-selection hook could only
   ever answer for the coin currently picked. One poll, one set of prices. */

export function usePositions(account?: Address): Loaded<Position[]> {
  const [entry, setEntry] = useState<Stamped<Position[]>>();
  const [tick, setTick] = useState(0);
  const key = account ? `${account}:${tick}` : undefined;

  useEffect(() => {
    if (!key || !account) return;
    let live = true;
    (async () => {
      const ids = await publicClient.readContract({
        ...lending,
        functionName: "positionsOf",
        args: [account],
      });
      return Promise.all(
        ids.map(async (id): Promise<Position> => {
          const [[, cToken, collateralAmount, debtCB], ltv] = await Promise.all([
            publicClient.readContract({ ...lending, functionName: "positions", args: [id] }),
            publicClient.readContract({ ...lending, functionName: "ltvBps", args: [id] }),
          ]);
          return { id, cToken, collateralAmount, debtCB, ltvBps: ltv };
        })
      );
    })()
      .then((data) => live && setEntry({ key, data }))
      .catch(() => live && setEntry({ key, error: "Could not load your positions." }));
    return () => {
      live = false;
    };
  }, [key, account]);

  /* Positions are never shown across a change of account — that would be showing
     one person somebody else's money — so this matches on the address, and the
     tick is allowed to differ so a refresh does not blank the list. */
  const sameAccount = entry && account && entry.key.startsWith(`${account}:`) ? entry : undefined;

  return {
    data: sameAccount?.data,
    error: sameAccount?.error,
    loading: !!key && !sameAccount,
    refresh: useCallback(() => setTick((t) => t + 1), []),
  };
}

// ---------------------------------------------------------------------------
// Reverts, as sentences
// ---------------------------------------------------------------------------

/**
 * Turn a failed call into something a person can act on.
 *
 * Returns `undefined` when the visitor simply closed the wallet prompt — that
 * is an answer, not an error, and putting a red box under it teaches people
 * their own choices are faults.
 */
export function describeError(e: unknown): string | undefined {
  if (e instanceof BaseError) {
    if (e.walk((err) => err instanceof UserRejectedRequestError)) return undefined;

    const revert = e.walk((err) => err instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName;
      const args = (revert.data?.args ?? []) as readonly unknown[];
      switch (name) {
        case "LtvTooHigh": {
          const bps = Number(args[0] ?? 0);
          return `That works out at ${(bps / 100).toFixed(2)}% — past the ${MAX_LTV}% limit. Lock more, or borrow less.`;
        }
        case "InsufficientCBLiquidity":
          return "The desk does not have that much $CB left to lend right now.";
        case "CollateralDisabled":
          return "That coin is not accepted for new loans at the moment. Repaying and adding collateral still work.";
        case "DustAmount":
          return "That is below the minimum this coin can open a position with.";
        case "ZeroAmount":
        case "InvalidAmount":
          return "That amount is not something the contract will take.";
        case "NoPosition":
          return "That position is already closed.";
        case "NotPositionOwner":
          return "That position belongs to another wallet.";
        case "EnforcedPause":
          return "New borrowing is paused. Repaying, adding collateral and withdrawing still work.";
        case "InvalidPool":
        case "InvalidToken":
          return "The contract will not price that token.";
        default:
          if (name) return `The contract refused this: ${name}.`;
      }
    }

    if (e.shortMessage?.toLowerCase().includes("insufficient funds"))
      return "Not enough ETH in the wallet to pay for gas.";
    return e.shortMessage || "The transaction failed.";
  }
  return "The transaction failed.";
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/** Amounts are read, not audited: four decimals is plenty and 18 is noise. */
export function formatAmount(value: bigint, decimals: number, max = 4) {
  const n = Number(formatUnits(value, decimals));
  if (n === 0) return "0";
  if (n < 0.0001) return "<0.0001";
  return n.toLocaleString("en-US", { maximumFractionDigits: max });
}

/**
 * The same value with nothing lost — for filling a field, never for reading.
 *
 * `formatAmount` goes through a double to add thousands separators, and a double
 * holds about 15 significant digits against this chain's 18. That is invisible
 * in a summary line and wrong in an input: "Max" on a repay has to be the debt
 * to the wei, or the loan closes owing dust and stays open.
 */
export const exactAmount = (value: bigint, decimals: number) => formatUnits(value, decimals);

/**
 * A WETH value, for the sub-line under an amount.
 *
 * Significant digits rather than fixed decimals: these run from fractions of a
 * WETH down to millionths depending on the coin, and a fixed four places renders
 * most of this deployment's collateral as "0.0000". The unit is always written
 * out — an unlabelled decimal next to a token amount reads as dollars, which is
 * the one thing it is not.
 */
export function formatWeth(wei: bigint) {
  const n = Number(formatUnits(wei, 18));
  if (n === 0) return "—";
  if (n < 0.000001) return "<0.000001 WETH";
  return `${n.toLocaleString("en-US", { maximumSignificantDigits: 4 })} WETH`;
}

/**
 * An ERC-20 balance, for the Max buttons.
 *
 * Undefined while unknown and undefined on failure, which the callers treat as
 * "offer no Max" rather than "the balance is zero" — a Max button that fills in
 * 0 because a read timed out is worse than no Max button.
 */
export function useTokenBalance(token?: Address, account?: Address): bigint | undefined {
  const [entry, setEntry] = useState<{ key: string; balance: bigint }>();
  const key = token && account ? `${token}:${account}` : undefined;

  useEffect(() => {
    if (!key || !token || !account) return;
    let live = true;
    publicClient
      .readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [account] })
      .then((balance) => live && setEntry({ key, balance }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [key, token, account]);

  // Stamped like the rest: a balance belongs to one token and one account, and
  // showing the last one against a newly picked coin would put the wrong number
  // behind the Max button.
  return entry && entry.key === key ? entry.balance : undefined;
}

/** Parse a typed amount, tolerating the commas `formatAmount` puts in. */
export function parseAmount(text: string, decimals: number): bigint {
  const cleaned = text.replace(/,/g, "").trim();
  if (!cleaned || !/^\d*\.?\d*$/.test(cleaned)) return 0n;
  try {
    return parseUnits(cleaned, decimals);
  } catch {
    return 0n;
  }
}

export function useShortAddress(account?: Address) {
  return useMemo(() => (account ? `${account.slice(0, 6)}…${account.slice(-4)}` : undefined), [account]);
}
